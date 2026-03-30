#pragma once
#include <juce_gui_basics/juce_gui_basics.h>

namespace Rezo
{

// Large BPM + time signature display. Updated on the message thread.
class TransportDisplay : public juce::Component
{
public:
    TransportDisplay();
    void setBPM (double bpm);
    void setTimeSignature (int beats, int beatUnit);
    void paint (juce::Graphics&) override;

private:
    double bpm     { 120.0 };
    int    beats   { 4 };
    int    beatUnit { 4 };
};

} // namespace Rezo
