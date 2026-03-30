#pragma once
#include <juce_core/juce_core.h>
#include <functional>

namespace Rezo
{

enum class ConnectionState { Idle, Scanning, Connecting, Connected, Reconnecting };

// Platform-agnostic BLE transport interface.
// On macOS: implemented by CoreBluetoothBridge.mm
// (Future: Windows backend via WinRT)
//
// Threading contract:
//   - All methods are called from the JUCE message thread.
//   - All callbacks (onStateChanged, onPeripheralFound, onBeatReceived)
//     must be dispatched to the JUCE message thread before invocation.

class IBLETransport
{
public:
    virtual ~IBLETransport() = default;

    // Scan for a peripheral matching GATT::DEVICE_NAME.
    // Fires onPeripheralFound when found.
    virtual void startScan() = 0;
    virtual void stopScan() = 0;

    // Attempt direct connection by cached UUID (avoids scan, ~300ms vs ~3-8s).
    // Falls back to startScan() if the peripheral is not in cache.
    virtual void connectByUUID (const juce::String& peripheralUUID) = 0;

    virtual void disconnect() = 0;

    // Write raw bytes to CHAR_CMD.
    // useResponse: true = CBCharacteristicWriteWithResponse (reliable, slower)
    //              false = CBCharacteristicWriteWithoutResponse (fire-and-forget)
    virtual void writeCharacteristic (const juce::String& charUUID,
                                      const juce::MemoryBlock& data,
                                      bool useResponse = true) = 0;

    // Subscribe to STATUS notifications from the device.
    // Parsed beat index is delivered via onBeatReceived.
    virtual void subscribeToStatus() = 0;

    virtual ConnectionState getState() const = 0;
    virtual juce::String getConnectedDeviceUUID() const = 0;
    virtual int getRSSI() const = 0; // dBm, 0 if unknown

    // ── Callbacks (set by BLEManager, always invoked on JUCE message thread) ──
    std::function<void (ConnectionState)>                                    onStateChanged;
    std::function<void (const juce::String& uuid, const juce::String& name)> onPeripheralFound;
    std::function<void (uint8_t beat)>                                       onBeatReceived;
};

} // namespace Rezo
