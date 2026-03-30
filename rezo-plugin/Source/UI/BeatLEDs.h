#pragma once
#include <juce_gui_basics/juce_gui_basics.h>

namespace Rezo
{

// A row of beat dots (up to 7). The downbeat (dot 0) is distinctly colored.
// Animates the active beat from CURRENT_BEAT device notifications.
class BeatLEDs : public juce::Component, private juce::Timer
{
public:
    BeatLEDs();

    void setBeats (int numBeats);
    void setCurrentBeat (uint8_t beat); // 0-indexed

    void paint (juce::Graphics&) override;

private:
    void timerCallback() override; // fades the active dot

    int     numBeats    { 4 };
    int     activeBeat  { -1 };
    float   activeAlpha { 0.0f };
};

} // namespace Rezo
