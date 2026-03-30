#import <CoreBluetooth/CoreBluetooth.h>
#import <Foundation/Foundation.h>
#include "CoreBluetoothBridge.h"
#include "../Protocol/GATTConstants.h"
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <optional>

// ── Objective-C delegate ───────────────────────────────────────────────────────
// All CoreBluetooth callbacks arrive on our dedicated GCD serial queue.
// They are immediately bridged to the JUCE message thread via callAsync.

@interface RezoCBDelegate : NSObject <CBCentralManagerDelegate, CBPeripheralDelegate>

@property (nonatomic, strong) CBCentralManager* central;
@property (nonatomic, strong) CBPeripheral*     peripheral;
@property (nonatomic, strong) NSMutableDictionary<NSString*, CBCharacteristic*>* characteristics;
@property (nonatomic, copy) NSString* pendingConnectUUID;
@property (nonatomic, assign) int rssi;
@property (nonatomic, assign) BOOL pendingScan;

// Callbacks dispatched to JUCE message thread
@property (nonatomic, copy) void (^onStateChanged)(Rezo::ConnectionState);
@property (nonatomic, copy) void (^onPeripheralFound)(NSString* uuid, NSString* name);
@property (nonatomic, copy) void (^onBeatReceived)(uint8_t beat);
@property (nonatomic, copy) void (^onConnected)(NSString* uuid);
@property (nonatomic, copy) void (^onDisconnected)();

- (void)startScan;
- (void)stopScan;
- (void)connectByUUID:(NSString*)uuidString;
- (void)disconnect;
- (void)writeChar:(NSString*)charUUID data:(NSData*)data response:(BOOL)response;
- (void)subscribeToStatus;
- (void)startScanNow;
- (void)connectByUUIDNow:(NSString*)uuidString;

@end

namespace
{

static NSString* makeNSString (const char* text)
{
    return text != nullptr ? [NSString stringWithUTF8String:text] : nil;
}

// Parse "beat=N" from the firmware status notification string.
// Returns 0-indexed beat, or nullopt if not present.
static std::optional<uint8_t> parseBeatFromStatus (NSString* status)
{
    if (status == nil)
        return std::nullopt;

    NSArray<NSString*>* fields = [status componentsSeparatedByString:@";"];
    for (NSString* field in fields)
    {
        if ([field hasPrefix:@"beat="])
        {
            const NSInteger beat = [[field substringFromIndex:5] integerValue];
            if (beat > 0)
                return static_cast<uint8_t> (beat - 1); // convert to 0-indexed
        }
    }
    return std::nullopt;
}

static juce::String managerStateToString (CBManagerState state)
{
    switch (state)
    {
        case CBManagerStateUnknown:      return "Unknown";
        case CBManagerStateResetting:    return "Resetting";
        case CBManagerStateUnsupported:  return "Unsupported";
        case CBManagerStateUnauthorized: return "Unauthorized";
        case CBManagerStatePoweredOff:   return "PoweredOff";
        case CBManagerStatePoweredOn:    return "PoweredOn";
    }
    return "Invalid";
}

} // namespace

@implementation RezoCBDelegate

- (instancetype)init
{
    if (self = [super init])
    {
        _characteristics = [NSMutableDictionary dictionary];
        _rssi = 0;
        _pendingScan = NO;

        dispatch_queue_t bleQueue = dispatch_queue_create(
            "app.rezo.ble", DISPATCH_QUEUE_SERIAL);
        dispatch_set_target_queue(bleQueue,
            dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0));

        _central = [[CBCentralManager alloc] initWithDelegate:self
                                                        queue:bleQueue
                                                      options:@{}];
    }
    return self;
}

- (void)startScan
{
    self.pendingConnectUUID = nil;
    juce::Logger::writeToLog ("BLE startScan requested, central state=" + managerStateToString (self.central.state));

    if (self.central.state != CBManagerStatePoweredOn)
    {
        self.pendingScan = YES;
        juce::Logger::writeToLog ("BLE startScan queued until central is PoweredOn");
        return;
    }

    [self startScanNow];
}

- (void)startScanNow
{
    self.pendingScan = NO;
    juce::Logger::writeToLog ("BLE scanning");
    [self.central scanForPeripheralsWithServices:nil options:nil];
}

- (void)stopScan
{
    self.pendingScan = NO;
    juce::Logger::writeToLog ("BLE stopScan");
    [self.central stopScan];
}

- (void)connectByUUID:(NSString*)uuidString
{
    self.pendingScan = NO;
    juce::Logger::writeToLog ("BLE connectByUUID requested: " + juce::String::fromUTF8 ([uuidString UTF8String]));

    if (self.central.state != CBManagerStatePoweredOn)
    {
        self.pendingConnectUUID = [uuidString copy];
        juce::Logger::writeToLog ("BLE connectByUUID queued until central is PoweredOn");
        return;
    }

    [self connectByUUIDNow:uuidString];
}

- (void)connectByUUIDNow:(NSString*)uuidString
{
    self.pendingConnectUUID = nil;

    NSUUID* uuid = [[NSUUID alloc] initWithUUIDString:uuidString];
    if (!uuid)
    {
        juce::Logger::writeToLog ("BLE invalid UUID, falling back to scan");
        [self startScanNow];
        return;
    }

    NSArray* found = [self.central retrievePeripheralsWithIdentifiers:@[uuid]];
    if (found.count > 0)
    {
        self.peripheral = found.firstObject;
        self.peripheral.delegate = self;
        juce::Logger::writeToLog ("BLE retrieved peripheral from cache and connecting");
        [self.central connectPeripheral:self.peripheral options:nil];
    }
    else
    {
        juce::Logger::writeToLog ("BLE UUID not in cache, falling back to scan");
        [self startScanNow];
    }
}

- (void)disconnect
{
    self.pendingScan = NO;
    self.pendingConnectUUID = nil;
    juce::Logger::writeToLog ("BLE disconnect");
    if (self.peripheral)
        [self.central cancelPeripheralConnection:self.peripheral];
    self.peripheral = nil;
    [self.characteristics removeAllObjects];
}

- (void)writeChar:(NSString*)charUUID data:(NSData*)data response:(BOOL)response
{
    CBCharacteristic* ch = self.characteristics[charUUID];
    if (!ch || !self.peripheral) return;

    CBCharacteristicWriteType writeType = response
        ? CBCharacteristicWriteWithResponse
        : CBCharacteristicWriteWithoutResponse;
    [self.peripheral writeValue:data forCharacteristic:ch type:writeType];
}

- (void)subscribeToStatus
{
    NSString* uuid = makeNSString (Rezo::GATT::CHAR_STATUS);
    CBCharacteristic* ch = self.characteristics[uuid];
    if (ch)
        [self.peripheral setNotifyValue:YES forCharacteristic:ch];
}

// ── CBCentralManagerDelegate ──────────────────────────────────────────────────

- (void)centralManagerDidUpdateState:(CBCentralManager*)central
{
    juce::Logger::writeToLog ("BLE central state changed: " + managerStateToString (central.state));

    if (central.state != CBManagerStatePoweredOn)
        return;

    if (self.pendingConnectUUID != nil)
    {
        NSString* pendingUUID = [self.pendingConnectUUID copy];
        [self connectByUUIDNow:pendingUUID];
        return;
    }

    if (self.pendingScan)
        [self startScanNow];
}

- (void)centralManager:(CBCentralManager*)central
 didDiscoverPeripheral:(CBPeripheral*)peripheral
     advertisementData:(NSDictionary*)advertisementData
                  RSSI:(NSNumber*)RSSI
{
    NSString* name = peripheral.name;
    if (name == nil)
        name = advertisementData[CBAdvertisementDataLocalNameKey];
    if (name == nil)
        return;

    NSString* expectedName = makeNSString (Rezo::GATT::DEVICE_NAME);
    if (expectedName == nil || ![name isEqualToString:expectedName])
        return;

    self.rssi = RSSI.intValue;
    juce::Logger::writeToLog ("BLE discovered matching peripheral: "
                              + juce::String::fromUTF8 ([name UTF8String])
                              + " rssi=" + juce::String (self.rssi));

    [central stopScan];

    NSString* uuid     = peripheral.identifier.UUIDString;
    NSString* nameCopy = [name copy];

    if (self.onPeripheralFound)
    {
        juce::MessageManager::callAsync ([self, uuid, nameCopy] {
            if (self.onPeripheralFound)
                self.onPeripheralFound (uuid, nameCopy);
        });
    }
}

- (void)centralManager:(CBCentralManager*)central
  didConnectPeripheral:(CBPeripheral*)peripheral
{
    juce::Logger::writeToLog ("BLE didConnectPeripheral");
    NSString* serviceUUID = @(Rezo::GATT::SERVICE_UUID);
    CBUUID* svcCBUUID = [CBUUID UUIDWithString:serviceUUID];
    [peripheral discoverServices:@[svcCBUUID]];
}

- (void)centralManager:(CBCentralManager*)central
didFailToConnectPeripheral:(CBPeripheral*)peripheral
                 error:(NSError*)error
{
    juce::Logger::writeToLog ("BLE didFailToConnectPeripheral");
    if (self.onDisconnected)
    {
        juce::MessageManager::callAsync ([self] {
            if (self.onDisconnected) self.onDisconnected();
        });
    }
}

- (void)centralManager:(CBCentralManager*)central
didDisconnectPeripheral:(CBPeripheral*)peripheral
                 error:(NSError*)error
{
    [self.characteristics removeAllObjects];
    juce::Logger::writeToLog ("BLE didDisconnectPeripheral");
    if (self.onDisconnected)
    {
        juce::MessageManager::callAsync ([self] {
            if (self.onDisconnected) self.onDisconnected();
        });
    }
}

// ── CBPeripheralDelegate ──────────────────────────────────────────────────────

- (void)peripheral:(CBPeripheral*)peripheral
didDiscoverServices:(NSError*)error
{
    if (error) return;
    juce::Logger::writeToLog ("BLE didDiscoverServices");
    NSString* expectedServiceUUID = [NSString stringWithUTF8String:Rezo::GATT::SERVICE_UUID];
    if (expectedServiceUUID == nil) return;

    for (CBService* svc in peripheral.services)
    {
        NSString* serviceUUID = svc.UUID.UUIDString.lowercaseString;
        if (serviceUUID != nil && [serviceUUID isEqualToString:expectedServiceUUID])
            [peripheral discoverCharacteristics:nil forService:svc];
    }
}

- (void)peripheral:(CBPeripheral*)peripheral
didDiscoverCharacteristicsForService:(CBService*)service
             error:(NSError*)error
{
    if (error) return;
    juce::Logger::writeToLog ("BLE didDiscoverCharacteristicsForService");
    for (CBCharacteristic* ch in service.characteristics)
    {
        NSString* characteristicUUID = ch.UUID.UUIDString.lowercaseString;
        if (characteristicUUID != nil)
            self.characteristics[characteristicUUID] = ch;
    }

    NSString* uuid = peripheral.identifier.UUIDString;
    if (self.onConnected)
    {
        juce::MessageManager::callAsync ([self, uuid] {
            if (self.onConnected) self.onConnected (uuid);
        });
    }
}

- (void)peripheral:(CBPeripheral*)peripheral
didUpdateValueForCharacteristic:(CBCharacteristic*)characteristic
             error:(NSError*)error
{
    if (error || !characteristic.value || characteristic.value.length == 0) return;

    NSString* statusUUID = makeNSString (Rezo::GATT::CHAR_STATUS);
    if (statusUUID == nil) return;

    NSString* uuid = characteristic.UUID.UUIDString.lowercaseString;
    if (uuid == nil || ![uuid isEqualToString:statusUUID]) return;

    NSString* status = [[NSString alloc] initWithData:characteristic.value
                                             encoding:NSUTF8StringEncoding];
    juce::Logger::writeToLog ("BLE status: "
                              + (status != nil ? juce::String::fromUTF8 ([status UTF8String])
                                               : juce::String ("<nil>")));

    auto beat = parseBeatFromStatus (status);
    if (beat.has_value() && self.onBeatReceived)
    {
        const auto beatValue = *beat;
        juce::MessageManager::callAsync ([self, beatValue] {
            if (self.onBeatReceived) self.onBeatReceived (beatValue);
        });
    }
}

- (void)peripheral:(CBPeripheral*)peripheral
didReadRSSI:(NSNumber*)RSSI
             error:(NSError*)error
{
    if (!error)
        self.rssi = RSSI.intValue;
}

@end

// ── C++ wrapper ───────────────────────────────────────────────────────────────

namespace Rezo
{

static bool hostDeclaresBluetoothUsageDescription()
{
    auto* mainBundle = [NSBundle mainBundle];
    if (mainBundle == nil)
        return false;

    id usageDescription = [mainBundle objectForInfoDictionaryKey:@"NSBluetoothAlwaysUsageDescription"];
    if (![usageDescription isKindOfClass:[NSString class]])
        return false;

    return [(NSString*) usageDescription length] > 0;
}

class NullBLETransport : public IBLETransport
{
public:
    void startScan() override {}
    void stopScan() override {}
    void connectByUUID (const juce::String&) override {}
    void disconnect() override {}
    void writeCharacteristic (const juce::String&, const juce::MemoryBlock&, bool) override {}
    void subscribeToStatus() override {}

    ConnectionState getState() const override { return ConnectionState::Idle; }
    juce::String getConnectedDeviceUUID() const override { return {}; }
    int getRSSI() const override { return 0; }
};

class CoreBluetoothTransport : public IBLETransport
{
public:
    CoreBluetoothTransport()
    {
        delegate = [[RezoCBDelegate alloc] init];

        delegate.onPeripheralFound = [safeThis = juce::WeakReference<CoreBluetoothTransport> { this }] (NSString* uuid, NSString* name) mutable {
            if (safeThis != nullptr && safeThis->onPeripheralFound)
                safeThis->onPeripheralFound (juce::String::fromUTF8 ([uuid UTF8String]),
                                             juce::String::fromUTF8 ([name UTF8String]));
        };

        delegate.onConnected = [safeThis = juce::WeakReference<CoreBluetoothTransport> { this }] (NSString* uuid) mutable {
            if (safeThis == nullptr) return;
            safeThis->connectedUUID = juce::String::fromUTF8 ([uuid UTF8String]);
            safeThis->state = ConnectionState::Connected;
            if (safeThis->onStateChanged) safeThis->onStateChanged (safeThis->state);
        };

        delegate.onDisconnected = [safeThis = juce::WeakReference<CoreBluetoothTransport> { this }] {
            if (safeThis == nullptr) return;
            safeThis->connectedUUID = {};
            safeThis->state = ConnectionState::Idle;
            if (safeThis->onStateChanged) safeThis->onStateChanged (safeThis->state);
        };

        delegate.onBeatReceived = [safeThis = juce::WeakReference<CoreBluetoothTransport> { this }] (uint8_t beat) mutable {
            if (safeThis != nullptr && safeThis->onBeatReceived)
                safeThis->onBeatReceived (beat);
        };
    }

    ~CoreBluetoothTransport() override
    {
        delegate.onPeripheralFound = nil;
        delegate.onConnected       = nil;
        delegate.onDisconnected    = nil;
        delegate.onBeatReceived    = nil;
        [delegate disconnect];
    }

    void startScan() override
    {
        state = ConnectionState::Scanning;
        [delegate startScan];
    }

    void stopScan() override { [delegate stopScan]; }

    void connectByUUID (const juce::String& peripheralUUID) override
    {
        state = ConnectionState::Connecting;
        NSString* uuidStr = [NSString stringWithUTF8String:peripheralUUID.toRawUTF8()];
        [delegate connectByUUID:uuidStr];
    }

    void disconnect() override
    {
        state = ConnectionState::Idle;
        connectedUUID = {};
        [delegate disconnect];
    }

    void writeCharacteristic (const juce::String& charUUID,
                               const juce::MemoryBlock& data,
                               bool useResponse) override
    {
        NSString* uuidStr = [NSString stringWithUTF8String:charUUID.toRawUTF8()];
        NSData*   nsData  = [NSData dataWithBytes:data.getData()
                                           length:data.getSize()];
        [delegate writeChar:uuidStr data:nsData response:useResponse];
    }

    void subscribeToStatus() override { [delegate subscribeToStatus]; }

    ConnectionState getState() const override { return state; }
    juce::String getConnectedDeviceUUID() const override { return connectedUUID; }
    int getRSSI() const override { return delegate.rssi; }

private:
    RezoCBDelegate* delegate { nil };
    ConnectionState state { ConnectionState::Idle };
    juce::String    connectedUUID;

    JUCE_DECLARE_WEAK_REFERENCEABLE (CoreBluetoothTransport)
};

std::unique_ptr<IBLETransport> createCoreBluetootTransport()
{
    if (! hostDeclaresBluetoothUsageDescription())
    {
        juce::Logger::writeToLog (
            "Rezo: host process is missing NSBluetoothAlwaysUsageDescription; BLE disabled to avoid TCC crash.");
        return std::make_unique<NullBLETransport>();
    }

    return std::make_unique<CoreBluetoothTransport>();
}

} // namespace Rezo
