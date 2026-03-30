#include "RezoLookAndFeel.h"

namespace Rezo
{

RezoLookAndFeel::RezoLookAndFeel()
{
    setColour (juce::ResizableWindow::backgroundColourId,
               juce::Colour (Colors::Background));
    setColour (juce::Label::textColourId,
               juce::Colour (Colors::TextPrimary));
    setColour (juce::ComboBox::backgroundColourId,
               juce::Colour (Colors::Surface));
    setColour (juce::ComboBox::textColourId,
               juce::Colour (Colors::TextPrimary));
    setColour (juce::ComboBox::outlineColourId,
               juce::Colour (Colors::Border));
    setColour (juce::ComboBox::arrowColourId,
               juce::Colour (Colors::TextMuted));
    setColour (juce::Slider::backgroundColourId,
               juce::Colour (Colors::SliderTrack));
    setColour (juce::Slider::thumbColourId,
               juce::Colour (Colors::SliderThumb));
    setColour (juce::Slider::trackColourId,
               juce::Colour (Colors::SliderThumb));
    setColour (juce::PopupMenu::backgroundColourId,
               juce::Colour (Colors::Surface));
    setColour (juce::PopupMenu::textColourId,
               juce::Colour (Colors::TextPrimary));
    setColour (juce::PopupMenu::highlightedBackgroundColourId,
               juce::Colour (Colors::Border));
}

void RezoLookAndFeel::drawLinearSlider (juce::Graphics& g,
                                         int x, int y, int w, int h,
                                         float sliderPos,
                                         float /*minSliderPos*/, float /*maxSliderPos*/,
                                         juce::Slider::SliderStyle style,
                                         juce::Slider& /*slider*/)
{
    if (style != juce::Slider::LinearHorizontal &&
        style != juce::Slider::LinearBar) return;

    const float trackH  = 4.0f;
    const float thumbW  = 14.0f;
    const float thumbH  = 22.0f;
    const float centerY = y + h * 0.5f;
    const float trackY  = centerY - trackH * 0.5f;

    // Track background
    g.setColour (juce::Colour (Colors::SliderTrack));
    g.fillRoundedRectangle ((float)x, trackY, (float)w, trackH, 2.0f);

    // Filled portion
    g.setColour (juce::Colour (Colors::SliderThumb));
    float filled = sliderPos - (float)x;
    if (filled > 0)
        g.fillRoundedRectangle ((float)x, trackY, filled, trackH, 2.0f);

    // Thumb
    float thumbX = sliderPos - thumbW * 0.5f;
    g.setColour (juce::Colour (Colors::SliderThumb));
    g.fillRoundedRectangle (thumbX, centerY - thumbH * 0.5f, thumbW, thumbH, 4.0f);
}

void RezoLookAndFeel::drawRotarySlider (juce::Graphics& g,
                                         int x, int y, int w, int h,
                                         float sliderPos,
                                         float startAngle, float endAngle,
                                         juce::Slider&)
{
    const float radius = juce::jmin (w, h) * 0.4f;
    const float cx = x + w * 0.5f;
    const float cy = y + h * 0.5f;
    const float angle = startAngle + sliderPos * (endAngle - startAngle);

    g.setColour (juce::Colour (Colors::SliderTrack));
    juce::Path arc;
    arc.addCentredArc (cx, cy, radius, radius, 0.0f, startAngle, endAngle, true);
    g.strokePath (arc, juce::PathStrokeType (4.0f,
        juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    g.setColour (juce::Colour (Colors::SliderThumb));
    juce::Path filled;
    filled.addCentredArc (cx, cy, radius, radius, 0.0f, startAngle, angle, true);
    g.strokePath (filled, juce::PathStrokeType (4.0f,
        juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    // Thumb dot
    float tx = cx + radius * std::cos (angle - juce::MathConstants<float>::halfPi);
    float ty = cy + radius * std::sin (angle - juce::MathConstants<float>::halfPi);
    g.fillEllipse (tx - 5, ty - 5, 10, 10);
}

void RezoLookAndFeel::drawComboBox (juce::Graphics& g, int w, int h,
                                     bool /*isDown*/,
                                     int buttonX, int buttonY,
                                     int buttonW, int buttonH,
                                     juce::ComboBox& /*box*/)
{
    g.setColour (juce::Colour (Colors::Surface));
    g.fillRoundedRectangle (0, 0, (float)w, (float)h, 6.0f);
    g.setColour (juce::Colour (Colors::Border));
    g.drawRoundedRectangle (0.5f, 0.5f, (float)w - 1, (float)h - 1, 6.0f, 1.0f);

    // Arrow
    float arrowCX = buttonX + buttonW * 0.5f;
    float arrowCY = buttonY + buttonH * 0.5f;
    juce::Path arrow;
    arrow.addTriangle (arrowCX - 5, arrowCY - 2, arrowCX + 5, arrowCY - 2, arrowCX, arrowCY + 4);
    g.setColour (juce::Colour (Colors::TextMuted));
    g.fillPath (arrow);
}

void RezoLookAndFeel::drawToggleButton (juce::Graphics& g, juce::ToggleButton& btn,
                                         bool /*isHighlighted*/, bool /*isDown*/)
{
    const bool on = btn.getToggleState();
    auto bounds = btn.getLocalBounds().toFloat().reduced (2.0f);

    g.setColour (on ? juce::Colour (Colors::AccentBlue).withAlpha (0.25f)
                    : juce::Colour (Colors::Surface));
    g.fillRoundedRectangle (bounds, 6.0f);

    g.setColour (on ? juce::Colour (Colors::AccentBlue)
                    : juce::Colour (Colors::Border));
    g.drawRoundedRectangle (bounds.reduced (0.5f), 6.0f, 1.0f);

    g.setColour (on ? juce::Colour (Colors::AccentBlue)
                    : juce::Colour (Colors::TextMuted));
    g.setFont (14.0f);
    g.drawFittedText (btn.getButtonText(), btn.getLocalBounds(),
                      juce::Justification::centred, 1);
}

juce::Font RezoLookAndFeel::getLabelFont (juce::Label&)
{
    return juce::Font (juce::FontOptions().withHeight (14.0f));
}

juce::Font RezoLookAndFeel::getComboBoxFont (juce::ComboBox&)
{
    return juce::Font (juce::FontOptions().withHeight (14.0f));
}

} // namespace Rezo
