#include "BLEManager.h"
#include "../Protocol/GATTConstants.h"

namespace Rezo
{
namespace
{
void notifyStateChange (BLEManager& manager, ConnectionState state)
{
    if (manager.onStateChanged)
        manager.onStateChanged (state);
    if (manager.onStateChangedSecondary)
        manager.onStateChangedSecondary (state);
}
}

BLEManager::BLEManager (std::unique_ptr<IBLETransport> t)
    : transport (std::move (t))
{
    transport->onStateChanged = [safeThis = juce::WeakReference<BLEManager> { this }] (ConnectionState s) mutable {
        if (safeThis != nullptr)
            safeThis->onTransportStateChanged (s);
    };
    transport->onPeripheralFound = [safeThis = juce::WeakReference<BLEManager> { this }] (const juce::String& uuid,
                                                                                            const juce::String& name) mutable {
        if (safeThis != nullptr)
            safeThis->onPeripheralFound (uuid, name);
    };
    transport->onBeatReceived = [safeThis = juce::WeakReference<BLEManager> { this }] (uint8_t beat) mutable {
        if (safeThis != nullptr && safeThis->onBeatReceived)
            safeThis->onBeatReceived (beat);
    };

    startTimerHz (50); // 20ms tick
}

BLEManager::~BLEManager()
{
    stopTimer();

    if (transport != nullptr)
    {
        transport->onStateChanged    = nullptr;
        transport->onPeripheralFound = nullptr;
        transport->onBeatReceived    = nullptr;
    }
}

// ── Audio-thread entry point (lock-free) ──────────────────────────────────────

void BLEManager::pushCommand (const BLECommand& cmd)
{
    int start1, size1, start2, size2;
    fifo.prepareToWrite (1, start1, size1, start2, size2);
    if (size1 > 0)
    {
        fifoBuffer[start1] = cmd;
        fifo.finishedWrite (1);
    }
    // If FIFO is full, the command is silently dropped — intentional.
    // The next processBlock() will push a fresh command with the latest state.
}

// ── Message-thread control ────────────────────────────────────────────────────

void BLEManager::startConnecting (const juce::String& cachedUUID)
{
    jassert (juce::MessageManager::getInstance()->isThisTheMessageThread());

    if (currentState == ConnectionState::Connected)
        return;

    deviceUUID = cachedUUID;
    reconnectAttempts = 0;

    if (cachedUUID.isNotEmpty())
        transport->connectByUUID (cachedUUID);
    else
        transport->startScan();

    currentState = cachedUUID.isNotEmpty() ? ConnectionState::Connecting
                                           : ConnectionState::Scanning;
    notifyStateChange (*this, currentState);
}

void BLEManager::disconnect()
{
    jassert (juce::MessageManager::getInstance()->isThisTheMessageThread());
    transport->disconnect();
    currentState = ConnectionState::Idle;
    notifyStateChange (*this, currentState);
}

int BLEManager::getRSSI() const
{
    return transport ? transport->getRSSI() : 0;
}

// ── Timer — drains command FIFO (message thread) ──────────────────────────────

void BLEManager::timerCallback()
{
    // ── 1. Drain BLE command FIFO ─────────────────────────────────────────────
    if (currentState == ConnectionState::Connected)
    {
        int start1, size1, start2, size2;
        fifo.prepareToRead (fifo.getNumReady(), start1, size1, start2, size2);

        auto processRange = [&] (int start, int count)
        {
            for (int i = 0; i < count; ++i)
            {
                const auto& cmd = fifoBuffer[start + i];
                auto now     = juce::Time::currentTimeMillis();
                auto typeIdx = static_cast<int> (cmd.type);

                if (now - lastWriteMs[typeIdx] < DEBOUNCE_MS)
                    continue;

                lastWriteMs[typeIdx] = now;

                using T = BLECommand::Type;
                switch (cmd.type)
                {
                    case T::Transport:
                    {
                        lastState.isPlaying = (cmd.byte0 == 1);
                        transport->writeCharacteristic (
                            GATT::CHAR_CMD,
                            GATT::buildTransportCmd (lastState.isPlaying),
                            true);
                        break;
                    }
                    case T::BPM:
                    {
                        lastState.bpm = cmd.floatVal;
                        transport->writeCharacteristic (
                            GATT::CHAR_CMD,
                            GATT::buildBPMCmd (lastState.bpm),
                            true);
                        break;
                    }
                    case T::TimeSignature:
                    {
                        lastState.beats    = cmd.byte0;
                        lastState.beatUnit = cmd.byte1;
                        transport->writeCharacteristic (
                            GATT::CHAR_CMD,
                            GATT::buildTSCmd (cmd.byte0, cmd.byte1),
                            true);
                        break;
                    }
                    case T::Pattern:
                    {
                        lastState.pattern = cmd.byte0;
                        transport->writeCharacteristic (
                            GATT::CHAR_CMD,
                            GATT::buildPatternCmd (cmd.byte0),
                            true);
                        break;
                    }
                    case T::Mode:
                    {
                        lastState.mode = (cmd.byte0 == 0) ? "INTERNAL"
                                                          : (cmd.byte0 == 2 ? "MIDI_BEAT" : "MIDI_CLOCK");
                        transport->writeCharacteristic (
                            GATT::CHAR_CMD,
                            GATT::buildModeCmd (lastState.mode),
                            true);
                        break;
                    }
                    case T::SideMode:
                    {
                        lastState.sideMode = cmd.byte0;
                        transport->writeCharacteristic (
                            GATT::CHAR_CMD,
                            GATT::buildSideCmd (cmd.byte0 != 0),
                            true);
                        break;
                    }
                    case T::Polyrhythm:
                    {
                        lastState.polyLeft  = cmd.byte0;
                        lastState.polyRight = cmd.byte1;
                        transport->writeCharacteristic (
                            GATT::CHAR_CMD,
                            GATT::buildPolyrhythmCmd (cmd.byte0, cmd.byte1),
                            true);
                        break;
                    }
                }
            }
        };

        processRange (start1, size1);
        processRange (start2, size2);
        fifo.finishedRead (size1 + size2);
    }

    // ── 2. Reconnect state machine ────────────────────────────────────────────
    if (currentState == ConnectionState::Reconnecting)
    {
        auto now     = juce::Time::currentTimeMillis();
        auto elapsed = now - disconnectTimeMs;

        if (now - reconnectAttemptMs >= RECONNECT_INITIAL_MS)
        {
            reconnectAttemptMs = now;
            ++reconnectAttempts;

            if (elapsed > (int64_t)RECONNECT_FULL_SCAN_S * 1000)
            {
                transport->startScan();
                currentState = ConnectionState::Scanning;
                notifyStateChange (*this, currentState);
            }
            else if (deviceUUID.isNotEmpty())
            {
                transport->connectByUUID (deviceUUID);
            }
            else
            {
                transport->startScan();
                currentState = ConnectionState::Scanning;
                notifyStateChange (*this, currentState);
            }
        }
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

void BLEManager::onTransportStateChanged (ConnectionState s)
{
    jassert (juce::MessageManager::getInstance()->isThisTheMessageThread());

    if (s == ConnectionState::Connected)
    {
        currentState = ConnectionState::Connected;
        deviceUUID   = transport->getConnectedDeviceUUID();
        transport->subscribeToStatus();
        burstWriteAllState();
        reconnectAttempts = 0;
        notifyStateChange (*this, currentState);
    }
    else if (s == ConnectionState::Idle && currentState == ConnectionState::Connected)
    {
        handleDisconnect();
    }
}

void BLEManager::onPeripheralFound (const juce::String& uuid, const juce::String&)
{
    transport->stopScan();
    deviceUUID = uuid;
    transport->connectByUUID (uuid);
    currentState = ConnectionState::Connecting;
    notifyStateChange (*this, currentState);
}

void BLEManager::handleDisconnect()
{
    disconnectTimeMs   = juce::Time::currentTimeMillis();
    reconnectAttemptMs = disconnectTimeMs;
    reconnectAttempts  = 0;
    currentState = ConnectionState::Reconnecting;

    juce::MessageManager::callAsync ([safeThis = juce::WeakReference<BLEManager> { this }]() mutable
    {
        if (safeThis != nullptr && safeThis->currentState == ConnectionState::Reconnecting)
            notifyStateChange (*safeThis, safeThis->currentState);
    });
}

void BLEManager::burstWriteAllState()
{
    // Reassert plugin-owned state on every connect/reconnect.
    // Force a STOP so the device never free-runs on reconnect before the next
    // explicit transport edge from the host.
    transport->writeCharacteristic (GATT::CHAR_CMD,
        GATT::buildModeCmd (lastState.mode), true);
    transport->writeCharacteristic (GATT::CHAR_CMD,
        GATT::buildSideCmd (lastState.sideMode != 0), true);
    transport->writeCharacteristic (GATT::CHAR_CMD,
        GATT::buildPolyrhythmCmd (lastState.polyLeft, lastState.polyRight), true);
    transport->writeCharacteristic (GATT::CHAR_CMD,
        GATT::buildBPMCmd (lastState.bpm), true);
    transport->writeCharacteristic (GATT::CHAR_CMD,
        GATT::buildTSCmd (lastState.beats, lastState.beatUnit), true);
    transport->writeCharacteristic (GATT::CHAR_CMD,
        GATT::buildPatternCmd (lastState.pattern), true);
    transport->writeCharacteristic (GATT::CHAR_CMD,
        GATT::buildTransportCmd (false), true);
    lastState.isPlaying = false;
}

} // namespace Rezo
