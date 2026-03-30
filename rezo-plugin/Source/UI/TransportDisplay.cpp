#include "TransportDisplay.h"
#include "RezoLookAndFeel.h"

namespace Rezo
{

TransportDisplay::TransportDisplay()
{
    setInterceptsMouseClicks (false, false);
}

void TransportDisplay::setBPM (double b)
{
    if (std::abs (b - bpm) > 0.01) { bpm = b; repaint(); }
}

void TransportDisplay::setTimeSignature (int b, int u)
{
    if (b != beats || u != beatUnit) { beats = b; beatUnit = u; repaint(); }
}

void TransportDisplay::paint (juce::Graphics& g)
{
    auto bounds = getLocalBounds().toFloat();

    // BPM — 48pt monospaced
    juce::String bpmStr = juce::String (bpm, 1);
    g.setColour (juce::Colour (Colors::TextPrimary));
    g.setFont (juce::Font (juce::FontOptions().withHeight (48.0f)));
    g.drawText (bpmStr, bounds.withHeight (bounds.getHeight() * 0.6f),
                juce::Justification::centred);

    // "BPM" label — muted, 12pt
    g.setColour (juce::Colour (Colors::TextMuted));
    g.setFont (juce::Font (juce::FontOptions().withHeight (12.0f)));
    auto bpmLabelBounds = bounds.withHeight (bounds.getHeight() * 0.6f);
    // Position after the number
    g.drawText ("BPM", bpmLabelBounds.translated (60.0f, 8.0f).withWidth (40.0f),
                juce::Justification::centredLeft);

    // Time signature — 22pt
    juce::String tsStr = juce::String (beats) + " / " + juce::String (beatUnit);
    g.setColour (juce::Colour (Colors::TextPrimary));
    g.setFont (juce::Font (juce::FontOptions().withHeight (22.0f)));
    g.drawText (tsStr, bounds.withY (bounds.getHeight() * 0.6f)
                                  .withHeight (bounds.getHeight() * 0.4f),
                juce::Justification::centred);
}

} // namespace Rezo
