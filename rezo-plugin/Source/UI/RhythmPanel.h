#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>

namespace Rezo
{

class RhythmPanel : public juce::Component
{
public:
    explicit RhythmPanel (juce::AudioProcessorValueTreeState& apvts);
    void resized() override;
    void paint (juce::Graphics&) override;

private:
    juce::Label label;
    juce::Label leftLabel;
    juce::Label rightLabel;
    juce::ComboBox sideModeBox;
    juce::ComboBox leftBox;
    juce::ComboBox rightBox;

    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> sideAttach;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> leftAttach;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> rightAttach;
};

} // namespace Rezo
