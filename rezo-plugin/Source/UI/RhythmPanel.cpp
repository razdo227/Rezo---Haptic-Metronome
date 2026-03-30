#include "RhythmPanel.h"
#include "RezoLookAndFeel.h"
#include "../PluginParameters.h"

namespace Rezo
{

RhythmPanel::RhythmPanel (juce::AudioProcessorValueTreeState& apvts)
{
    label.setText ("RHYTHM", juce::dontSendNotification);
    label.setColour (juce::Label::textColourId, juce::Colour (Colors::TextMuted));
    label.setFont (juce::Font (juce::FontOptions().withHeight (11.0f)));
    addAndMakeVisible (label);

    leftLabel.setText ("L", juce::dontSendNotification);
    leftLabel.setColour (juce::Label::textColourId, juce::Colour (Colors::TextMuted));
    leftLabel.setFont (juce::Font (juce::FontOptions().withHeight (11.0f)));
    addAndMakeVisible (leftLabel);

    rightLabel.setText ("R", juce::dontSendNotification);
    rightLabel.setColour (juce::Label::textColourId, juce::Colour (Colors::TextMuted));
    rightLabel.setFont (juce::Font (juce::FontOptions().withHeight (11.0f)));
    addAndMakeVisible (rightLabel);

    sideModeBox.addItem ("Both", 1);
    sideModeBox.addItem ("Alternate", 2);
    addAndMakeVisible (sideModeBox);

    leftBox.addItem ("Auto", 1);
    rightBox.addItem ("Auto", 1);
    for (int i = 1; i <= 8; ++i)
    {
        leftBox.addItem (juce::String (i), i + 1);
        rightBox.addItem (juce::String (i), i + 1);
    }
    addAndMakeVisible (leftBox);
    addAndMakeVisible (rightBox);

    sideAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (
        apvts, ParamIDs::SIDE_MODE, sideModeBox);
    leftAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (
        apvts, ParamIDs::POLY_LEFT, leftBox);
    rightAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (
        apvts, ParamIDs::POLY_RIGHT, rightBox);
}

void RhythmPanel::resized()
{
    auto b = getLocalBounds().reduced (12, 0);
    const int rowH = 36;
    const int labelW = 80;
    const int chipW = 72;

    auto row1 = b.removeFromTop (rowH);
    label.setBounds (row1.removeFromLeft (labelW));
    sideModeBox.setBounds (row1);

    b.removeFromTop (4);

    auto row2 = b.removeFromTop (rowH);
    row2.removeFromLeft (labelW);
    leftLabel.setBounds (row2.removeFromLeft (18));
    leftBox.setBounds (row2.removeFromLeft (chipW));
    row2.removeFromLeft (12);
    rightLabel.setBounds (row2.removeFromLeft (18));
    rightBox.setBounds (row2.removeFromLeft (chipW));
}

void RhythmPanel::paint (juce::Graphics& g)
{
    g.setColour (juce::Colour (Colors::Surface));
    g.fillRoundedRectangle (getLocalBounds().toFloat(), 8.0f);
}

} // namespace Rezo
