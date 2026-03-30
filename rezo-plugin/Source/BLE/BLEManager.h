#pragma once
#include <juce_core/juce_core.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include "IBLETransport.h"
#include "../Protocol/GATTWriter.h"
#include <atomic>
#include <functional>
#include <memory>

namespace Rezo
{

// Commands pushed from the audio thread into the lock-free FIFO.
// Keep this a plain-old-data struct — no heap allocation, no JUCE types.
struct BLECommand
{
    enum class Type : uint8_t
    {
        Transport,
        BPM,
        TimeSignature,
        Pattern,
        Mode,
        SideMode,
        Polyrhythm
    };

    Type    type;
    uint8_t byte0 { 0 };
    uint8_t byte1 { 0 };
    double  floatVal { 0.0 }; // used for BPM
};

// BLEManager owns the IBLETransport and implements:
//   - Lock-free command FIFO (audio thread → message thread)
//   - 50ms debounce per command type (avoids BLE flooding)
//   - Reconnect state machine with exponential backoff
//   - 2-second UI debounce on disconnect (stage usability)
//
// All public methods must be called from the JUCE message thread,
// except pushCommand() which is safe on the audio thread.

class BLEManager : private juce::Timer
{
public:
    explicit BLEManager (std::unique_ptr<IBLETransport> transport);
    ~BLEManager() override;

    // Called from the audio thread (lock-free, wait-free).
    void pushCommand (const BLECommand& cmd);

    // Message-thread control
    void startConnecting (const juce::String& cachedUUID = {});
    void disconnect();

    ConnectionState getState() const { return currentState; }
    juce::String    getDeviceUUID()  const { return deviceUUID; }
    int             getRSSI()        const;

    // Callbacks — invoked on the JUCE message thread
    std::function<void (ConnectionState)> onStateChanged;
    std::function<void (ConnectionState)> onStateChangedSecondary;
    std::function<void (uint8_t beat)>    onBeatReceived;

private:
    // juce::Timer — drains FIFO at 20ms intervals on the message thread
    void timerCallback() override;

    void onTransportStateChanged (ConnectionState s);
    void onPeripheralFound (const juce::String& uuid, const juce::String& name);
    void handleDisconnect();
    void burstWriteAllState();

    std::unique_ptr<IBLETransport> transport;

    // Lock-free FIFO — audio thread writes, message thread reads
    static constexpr int FIFO_SIZE = 64;
    juce::AbstractFifo   fifo { FIFO_SIZE };
    BLECommand           fifoBuffer[FIFO_SIZE];

    // Debounce: last write time per command type.
    static constexpr int DEBOUNCE_MS = 50;
    int64_t lastWriteMs[7] = {};

    // Reconnect state machine
    ConnectionState  currentState { ConnectionState::Idle };
    juce::String     deviceUUID;
    int64_t          disconnectTimeMs { 0 };
    int64_t          reconnectAttemptMs { 0 };
    int              reconnectAttempts { 0 };
    static constexpr int RECONNECT_INITIAL_MS = 500;
    static constexpr int RECONNECT_FULL_SCAN_S = 30;

    // Snapshot of last-sent state for burst-write on reconnect
    struct LastState
    {
        bool    isPlaying { false };
        double  bpm       { 120.0 };
        uint8_t beats     { 4 };
        uint8_t beatUnit  { 4 };
        uint8_t pattern   { 15 };   // default: STRONG_CLICK
        uint8_t sideMode  { 0 };    // 0=UNISON, 1=ALTERNATE
        uint8_t polyLeft  { 0 };    // 0=follow beat count
        uint8_t polyRight { 0 };    // 0=follow beat count
        juce::String mode { "MIDI_CLOCK" };
    } lastState;

    JUCE_DECLARE_WEAK_REFERENCEABLE (BLEManager)
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BLEManager)
};

} // namespace Rezo
