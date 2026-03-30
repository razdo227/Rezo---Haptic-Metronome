#pragma once
#include <juce_gui_basics/juce_gui_basics.h>
#include "../BLE/IBLETransport.h"

namespace Rezo
{

// Shows: status dot (green/amber/red), device name, RSSI bar.
// Updated from BLEManager callbacks (always on the message thread).
class ConnectionPanel : public juce::Component, private juce::Timer
{
public:
    ConnectionPanel();

    void setState (ConnectionState state, const juce::String& deviceName, int rssiDBm);
    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override; // pulses the dot while reconnecting

    ConnectionState currentState { ConnectionState::Idle };
    juce::String    deviceName   { "Not connected" };
    int             rssi         { 0 };
    float           dotAlpha     { 1.0f };
    bool            dotPhase     { false };
};

} // namespace Rezo
