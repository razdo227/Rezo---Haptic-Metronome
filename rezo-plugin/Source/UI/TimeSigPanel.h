#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>

namespace Rezo
{

// Time signature panel: DAW sync / Manual radio + manual numerator/denominator
// pickers (active only when Manual is selected).
class TimeSigPanel : public juce::Component
{
public:
    explicit TimeSigPanel (juce::AudioProcessorValueTreeState& apvts);
    void resized() override;
    void paint (juce::Graphics&) override;

private:
    void updateManualEnabled();

    juce::Label       label;
    juce::ToggleButton dawBtn, manualBtn;
    juce::ComboBox    numeratorBox, denominatorBox;

    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment>   overrideAttach;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> numeratorAttach;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> denominatorAttach;

    juce::AudioProcessorValueTreeState& apvts;
};

} // namespace Rezo
