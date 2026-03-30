#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "UI/RezoLookAndFeel.h"
#include "UI/ConnectionPanel.h"
#include "UI/TransportDisplay.h"
#include "UI/BeatLEDs.h"
#include "UI/VibrationPanel.h"
#include "UI/RhythmPanel.h"
#include "UI/TimeSigPanel.h"

namespace Rezo
{
class RezoProcessor;

class RezoEditor : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit RezoEditor (RezoProcessor& processor);
    ~RezoEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override; // polls atomic display values from processor

    RezoProcessor&     processorRef;
    RezoLookAndFeel    laf;

    ConnectionPanel    connectionPanel;
    TransportDisplay   transportDisplay;
    BeatLEDs           beatLEDs;
    VibrationPanel     vibrationPanel;
    RhythmPanel        rhythmPanel;
    TimeSigPanel       timeSigPanel;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RezoEditor)
};

} // namespace Rezo
