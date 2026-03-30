#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_gui_basics/juce_gui_basics.h>

namespace Rezo
{

// Vibration pattern picker wired to APVTS.
class VibrationPanel : public juce::Component
{
public:
    explicit VibrationPanel (juce::AudioProcessorValueTreeState& apvts);
    void resized() override;
    void paint (juce::Graphics&) override;

private:
    juce::Label    vibLabel;
    juce::ComboBox presetBox;

    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> presetAttach;
};

} // namespace Rezo
