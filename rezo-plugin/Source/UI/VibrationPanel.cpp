#include "VibrationPanel.h"
#include "RezoLookAndFeel.h"
#include "../PluginParameters.h"
#include "../Protocol/GATTConstants.h"

namespace Rezo
{

VibrationPanel::VibrationPanel (juce::AudioProcessorValueTreeState& apvts)
{
    vibLabel.setText ("TYPE", juce::dontSendNotification);
    vibLabel.setColour (juce::Label::textColourId, juce::Colour (Colors::TextMuted));
    vibLabel.setFont (juce::Font (juce::FontOptions().withHeight (11.0f)));
    addAndMakeVisible (vibLabel);

    presetBox.addItem ("Strong", 1);
    presetBox.addItem ("Gentle", 2);
    presetBox.addItem ("Sharp", 3);
    presetBox.addItem ("Buzz", 4);

    addAndMakeVisible (presetBox);

    presetAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (
        apvts, ParamIDs::VIBRATION_PRESET, presetBox);
}

void VibrationPanel::resized()
{
    auto b = getLocalBounds().reduced (12, 0);
    const int rowH   = 36;
    const int labelW = 80;

    auto row = b.removeFromTop (rowH);
    vibLabel.setBounds (row.removeFromLeft (labelW));
    presetBox.setBounds (row);
}

void VibrationPanel::paint (juce::Graphics& g)
{
    g.setColour (juce::Colour (Colors::Surface));
    g.fillRoundedRectangle (getLocalBounds().toFloat(), 8.0f);
}

} // namespace Rezo
