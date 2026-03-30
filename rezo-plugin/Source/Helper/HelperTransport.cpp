#include "HelperTransport.h"
#include "HelperProtocol.h"
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>

namespace Rezo
{
namespace
{
constexpr int kConnectRetryMs = 1000;
constexpr int kConnectTimeoutMs = 150;
constexpr int kLaunchRetryMs = 3000;
constexpr auto kHelperBundleID = "app.rezo.helper";

class HelperTransport;

class HelperConnection final : public juce::InterprocessConnection
{
public:
    explicit HelperConnection (HelperTransport& ownerIn)
        : juce::InterprocessConnection (true, HelperProtocol::kMagic),
          owner (&ownerIn)
    {
    }

    ~HelperConnection() override
    {
        disconnect (250, Notify::no);
    }

    void connectionMade() override;
    void connectionLost() override;
    void messageReceived (const juce::MemoryBlock& message) override;

private:
    HelperTransport* owner;
};

class HelperTransport final : public IBLETransport,
                              private juce::Timer
{
public:
    HelperTransport()
    {
        connection = std::make_unique<HelperConnection> (*this);
        startTimer (kConnectRetryMs);
        ensureConnected();
    }

    ~HelperTransport() override
    {
        stopTimer();
        if (connection != nullptr)
            connection->disconnect (250, juce::InterprocessConnection::Notify::no);
    }

    void startScan() override
    {
        enqueueMessage (HelperProtocol::Message::startScan);
    }

    void stopScan() override
    {
        enqueueMessage (HelperProtocol::Message::stopScan);
    }

    void connectByUUID (const juce::String& peripheralUUID) override
    {
        enqueueMessage (HelperProtocol::joinFields ({ HelperProtocol::Message::connectUUID, peripheralUUID }));
    }

    void disconnect() override
    {
        pendingMessages.clear();
        enqueueMessage (HelperProtocol::Message::disconnect);
        connectedUUID.clear();
        rssi = 0;
        updateState (ConnectionState::Idle);
    }

    void writeCharacteristic (const juce::String& charUUID,
                              const juce::MemoryBlock& data,
                              bool useResponse) override
    {
        enqueueMessage (HelperProtocol::joinFields ({
            HelperProtocol::Message::write,
            charUUID,
            useResponse ? "1" : "0",
            HelperProtocol::encodeHex (data)
        }));
    }

    void subscribeToStatus() override
    {
        enqueueMessage (HelperProtocol::Message::subscribe);
    }

    ConnectionState getState() const override
    {
        return state;
    }

    juce::String getConnectedDeviceUUID() const override
    {
        return connectedUUID;
    }

    int getRSSI() const override
    {
        return rssi;
    }

    void handleConnectionMade()
    {
        if (onStateChanged != nullptr)
            onStateChanged (state);

        flushPendingMessages();
    }

    void handleConnectionLost()
    {
        connectedUUID.clear();
        rssi = 0;
        updateState (ConnectionState::Idle);
    }

    void handleMessage (const juce::MemoryBlock& message)
    {
        auto fields = HelperProtocol::splitFields (HelperProtocol::fromMessageBlock (message));
        if (fields.isEmpty())
            return;

        const auto command = fields[0];

        if (command == HelperProtocol::Message::state && fields.size() >= 2)
        {
            updateState (HelperProtocol::connectionStateFromString (fields[1]));
            return;
        }

        if (command == HelperProtocol::Message::found && fields.size() >= 3)
        {
            if (onPeripheralFound != nullptr)
                onPeripheralFound (fields[1], fields[2]);
            return;
        }

        if (command == HelperProtocol::Message::deviceUUID && fields.size() >= 2)
        {
            connectedUUID = fields[1];
            return;
        }

        if (command == HelperProtocol::Message::rssi && fields.size() >= 2)
        {
            rssi = fields[1].getIntValue();
            return;
        }

        if (command == HelperProtocol::Message::beat && fields.size() >= 2)
        {
            if (onBeatReceived != nullptr)
                onBeatReceived (static_cast<uint8_t> (juce::jlimit (0, 255, fields[1].getIntValue())));
        }
    }

private:
    void timerCallback() override
    {
        ensureConnected();
        flushPendingMessages();
    }

    void enqueueMessage (const juce::String& text)
    {
        pendingMessages.add (text);
        ensureConnected();
        flushPendingMessages();
    }

    void flushPendingMessages()
    {
        if (connection == nullptr || ! connection->isConnected())
            return;

        while (! pendingMessages.isEmpty())
        {
            if (! connection->sendMessage (HelperProtocol::toMessageBlock (pendingMessages[0])))
                break;

            pendingMessages.remove (0);
        }
    }

    void ensureConnected()
    {
        if (connection == nullptr || connection->isConnected())
            return;

        const auto now = juce::Time::currentTimeMillis();
        if (now - lastConnectAttemptMs < kConnectRetryMs)
            return;

        lastConnectAttemptMs = now;

        if (connection->connectToSocket ("127.0.0.1", HelperProtocol::kPort, kConnectTimeoutMs))
            return;

        launchHelperIfNeeded (now);
    }

    void launchHelperIfNeeded (int64_t now)
    {
        if (now - lastLaunchAttemptMs < kLaunchRetryMs)
            return;

        lastLaunchAttemptMs = now;

        const auto helperPath = juce::File::getSpecialLocation (juce::File::userHomeDirectory)
                                    .getChildFile ("Applications")
                                    .getChildFile ("Rezo Helper.app");

        if (helperPath.exists())
        {
            juce::ChildProcess child;
            if (child.start (juce::StringArray { "/usr/bin/open", "-g", helperPath.getFullPathName() }, 0))
                return;
        }

        juce::ChildProcess child;
        const auto launchedByBundle = child.start (juce::StringArray {
            "/usr/bin/open", "-g", "-b", kHelperBundleID
        }, 0);

        juce::ignoreUnused (launchedByBundle);
    }

    void updateState (ConnectionState newState)
    {
        if (state == newState)
            return;

        state = newState;
        if (onStateChanged != nullptr)
            onStateChanged (state);
    }

    std::unique_ptr<HelperConnection> connection;
    juce::StringArray pendingMessages;
    ConnectionState state { ConnectionState::Idle };
    juce::String connectedUUID;
    int rssi { 0 };
    int64_t lastConnectAttemptMs { 0 };
    int64_t lastLaunchAttemptMs { 0 };
};

void HelperConnection::connectionMade()
{
    if (owner != nullptr)
        owner->handleConnectionMade();
}

void HelperConnection::connectionLost()
{
    if (owner != nullptr)
        owner->handleConnectionLost();
}

void HelperConnection::messageReceived (const juce::MemoryBlock& message)
{
    if (owner != nullptr)
        owner->handleMessage (message);
}
} // namespace

std::unique_ptr<IBLETransport> createHelperTransport()
{
    return std::make_unique<HelperTransport>();
}

} // namespace Rezo
