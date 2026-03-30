#include "TimeSigPanel.h"
#include "RezoLookAndFeel.h"
#include "../PluginParameters.h"

namespace Rezo
{

TimeSigPanel::TimeSigPanel (juce::AudioProcessorValueTreeState& avpts)
    : apvts (avpts)
{
    label.setText ("TIME SIG", juce::dontSendNotification);
    label.setColour (juce::Label::textColourId, juce::Colour (Colors::TextMuted));
    label.setFont (juce::Font (juce::FontOptions().withHeight (11.0f)));
    addAndMakeVisible (label);

    dawBtn.setButtonText ("DAW");
    dawBtn.setRadioGroupId (1);
    dawBtn.setToggleState (true, juce::dontSendNotification);
    addAndMakeVisible (dawBtn);

    manualBtn.setButtonText ("Manual");
    manualBtn.setRadioGroupId (1);
    addAndMakeVisible (manualBtn);

    // Manual controls
    for (int i = 2; i <= 7; ++i)
        numeratorBox.addItem (juce::String (i), i - 1); // item ID = i-1
    addAndMakeVisible (numeratorBox);

    denominatorBox.addItem ("Quarter (4)", 1);
    denominatorBox.addItem ("Eighth (8)",  2);
    addAndMakeVisible (denominatorBox);

    overrideAttach = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment> (
        apvts, ParamIDs::TIMESIG_OVERRIDE, manualBtn);
    numeratorAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (
        apvts, ParamIDs::TIMESIG_NUMERATOR, numeratorBox);
    denominatorAttach = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (
        apvts, ParamIDs::TIMESIG_DENOMINATOR, denominatorBox);

    manualBtn.onClick = [this] { updateManualEnabled(); };
    dawBtn.onClick    = [this] { updateManualEnabled(); };

    updateManualEnabled();
}

void TimeSigPanel::updateManualEnabled()
{
    bool manual = manualBtn.getToggleState();
    numeratorBox.setEnabled (manual);
    denominatorBox.setEnabled (manual);
    numeratorBox.setAlpha  (manual ? 1.0f : 0.4f);
    denominatorBox.setAlpha (manual ? 1.0f : 0.4f);
}

void TimeSigPanel::resized()
{
    auto b = getLocalBounds().reduced (12, 0);
    const int rowH = 36;
    const int labelW = 80;

    auto row1 = b.removeFromTop (rowH);
    label.setBounds (row1.removeFromLeft (labelW));
    dawBtn.setBounds    (row1.removeFromLeft (70));
    row1.removeFromLeft (6);
    manualBtn.setBounds (row1.removeFromLeft (70));

    b.removeFromTop (4);

    auto row2 = b.removeFromTop (rowH);
    row2.removeFromLeft (labelW);
    numeratorBox.setBounds   (row2.removeFromLeft (70));
    row2.removeFromLeft (12);
    denominatorBox.setBounds (row2);
}

void TimeSigPanel::paint (juce::Graphics& g)
{
    g.setColour (juce::Colour (Colors::Surface));
    g.fillRoundedRectangle (getLocalBounds().toFloat(), 8.0f);
}

} // namespace Rezo
