#include "HelperProtocol.h"
#include "../BLE/CoreBluetoothBridge.h"
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include <algorithm>
#include <vector>

namespace Rezo
{
namespace
{
class HelperServer final : private juce::InterprocessConnectionServer,
                           private juce::AsyncUpdater
{
public:
    HelperServer()
    {
        const auto ok = beginWaitingForSocket (HelperProtocol::kPort, "127.0.0.1");
        jassert (ok);
        juce::ignoreUnused (ok);
    }

    ~HelperServer() override
    {
        stop();
        sessions.clear();
    }

private:
    class HelperSession final : public juce::InterprocessConnection
    {
    public:
        explicit HelperSession (std::function<void (HelperSession*)> onClosedIn)
            : juce::InterprocessConnection (true, HelperProtocol::kMagic),
              onClosed (std::move (onClosedIn)),
              transport (createCoreBluetootTransport())
        {
            transport->onStateChanged = [this] (ConnectionState newState)
            {
                sendState (newState);
                sendDeviceSnapshot();
            };

            transport->onPeripheralFound = [this] (const juce::String& uuid, const juce::String& name)
            {
                sendText (HelperProtocol::joinFields ({ HelperProtocol::Message::found, uuid, name }));
            };

            transport->onBeatReceived = [this] (uint8_t beat)
            {
                sendText (HelperProtocol::joinFields ({
                    HelperProtocol::Message::beat,
                    juce::String (static_cast<int> (beat))
                }));
            };
        }

        ~HelperSession() override
        {
            if (transport != nullptr)
            {
                transport->onStateChanged = nullptr;
                transport->onPeripheralFound = nullptr;
                transport->onBeatReceived = nullptr;
                transport->disconnect();
            }

            disconnect (250, Notify::no);
        }

        void connectionMade() override
        {
            sendState (transport->getState());
            sendDeviceSnapshot();
        }

        void connectionLost() override
        {
            if (transport != nullptr)
                transport->disconnect();

            if (onClosed != nullptr)
                onClosed (this);
        }

        void messageReceived (const juce::MemoryBlock& message) override
        {
            auto fields = HelperProtocol::splitFields (HelperProtocol::fromMessageBlock (message));
            if (fields.isEmpty() || transport == nullptr)
                return;

            const auto command = fields[0];
            juce::Logger::writeToLog ("Rezo Helper IPC recv: " + command);

            if (command == HelperProtocol::Message::startScan)
            {
                transport->startScan();
                return;
            }

            if (command == HelperProtocol::Message::stopScan)
            {
                transport->stopScan();
                return;
            }

            if (command == HelperProtocol::Message::connectUUID && fields.size() >= 2)
            {
                transport->connectByUUID (fields[1]);
                return;
            }

            if (command == HelperProtocol::Message::disconnect)
            {
                transport->disconnect();
                return;
            }

            if (command == HelperProtocol::Message::subscribe)
            {
                transport->subscribeToStatus();
                return;
            }

            if (command == HelperProtocol::Message::write && fields.size() >= 4)
            {
                transport->writeCharacteristic (fields[1],
                                               HelperProtocol::decodeHex (fields[3]),
                                               fields[2] == "1");
            }
        }

    private:
        void sendText (const juce::String& text)
        {
            sendMessage (HelperProtocol::toMessageBlock (text));
        }

        void sendState (ConnectionState state)
        {
            sendText (HelperProtocol::joinFields ({
                HelperProtocol::Message::state,
                HelperProtocol::connectionStateToString (state)
            }));
        }

        void sendDeviceSnapshot()
        {
            sendText (HelperProtocol::joinFields ({
                HelperProtocol::Message::deviceUUID,
                transport->getConnectedDeviceUUID()
            }));
            sendText (HelperProtocol::joinFields ({
                HelperProtocol::Message::rssi,
                juce::String (transport->getRSSI())
            }));
        }

        std::function<void (HelperSession*)> onClosed;
        std::unique_ptr<IBLETransport> transport;
    };

    juce::InterprocessConnection* createConnectionObject() override
    {
        auto session = std::make_unique<HelperSession> ([this] (HelperSession* sessionToRemove)
        {
            {
                const juce::ScopedLock lock (retiredLock);
                retiredSessions.add (sessionToRemove);
            }

            triggerAsyncUpdate();
        });

        auto* raw = session.get();
        sessions.push_back (std::move (session));
        return raw;
    }

    void handleAsyncUpdate() override
    {
        juce::Array<HelperSession*> retired;
        {
            const juce::ScopedLock lock (retiredLock);
            retired.swapWith (retiredSessions);
        }

        for (auto* session : retired)
        {
            sessions.erase (std::remove_if (sessions.begin(), sessions.end(),
                                            [session] (const std::unique_ptr<HelperSession>& candidate)
                                            {
                                                return candidate.get() == session;
                                            }),
                            sessions.end());
        }
    }

    juce::CriticalSection retiredLock;
    juce::Array<HelperSession*> retiredSessions;
    std::vector<std::unique_ptr<HelperSession>> sessions;
};

class RezoHelperApplication final : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override      { return "Rezo Helper"; }
    const juce::String getApplicationVersion() override   { return "1.0.0"; }
    bool moreThanOneInstanceAllowed() override            { return false; }

    void initialise (const juce::String&) override
    {
        juce::Process::setDockIconVisible (false);
        fileLogger.reset (juce::FileLogger::createDateStampedLogger ("Rezo",
                                                                     "RezoHelper",
                                                                     ".log",
                                                                     "Rezo Helper started"));
        juce::Logger::setCurrentLogger (fileLogger.get());
        helperServer = std::make_unique<HelperServer>();
        juce::Logger::writeToLog ("Rezo Helper server initialised");
    }

    void shutdown() override
    {
        juce::Logger::writeToLog ("Rezo Helper shutting down");
        helperServer.reset();
        juce::Logger::setCurrentLogger (nullptr);
        fileLogger.reset();
    }

    void systemRequestedQuit() override
    {
        quit();
    }

    void anotherInstanceStarted (const juce::String&) override {}

private:
    std::unique_ptr<HelperServer> helperServer;
    std::unique_ptr<juce::FileLogger> fileLogger;
};
} // namespace
} // namespace Rezo

START_JUCE_APPLICATION (Rezo::RezoHelperApplication)
