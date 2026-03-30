#pragma once
#include <juce_gui_basics/juce_gui_basics.h>

namespace Rezo
{

struct Colors
{
    static constexpr uint32_t Background   = 0xFF111318;
    static constexpr uint32_t Surface      = 0xFF1C2028;
    static constexpr uint32_t Border       = 0xFF2C3040;
    static constexpr uint32_t TextPrimary  = 0xFFECEFF4;
    static constexpr uint32_t TextMuted    = 0xFF6C7280;
    static constexpr uint32_t AccentGreen  = 0xFF4ADE80; // connected
    static constexpr uint32_t AccentAmber  = 0xFFFBBF24; // reconnecting
    static constexpr uint32_t AccentRed    = 0xFFEF4444; // disconnected
    static constexpr uint32_t AccentBlue   = 0xFF60A5FA; // beat highlight
    static constexpr uint32_t SliderThumb  = 0xFF60A5FA;
    static constexpr uint32_t SliderTrack  = 0xFF2C3040;
};

class RezoLookAndFeel : public juce::LookAndFeel_V4
{
public:
    RezoLookAndFeel();

    void drawRotarySlider (juce::Graphics&, int x, int y, int w, int h,
                           float sliderPos, float startAngle, float endAngle,
                           juce::Slider&) override;

    void drawLinearSlider (juce::Graphics&, int x, int y, int w, int h,
                           float sliderPos, float minSliderPos, float maxSliderPos,
                           juce::Slider::SliderStyle, juce::Slider&) override;

    void drawComboBox (juce::Graphics&, int w, int h, bool isDown,
                       int buttonX, int buttonY, int buttonW, int buttonH,
                       juce::ComboBox&) override;

    void drawToggleButton (juce::Graphics&, juce::ToggleButton&,
                           bool isHighlighted, bool isDown) override;

    juce::Font getLabelFont (juce::Label&) override;
    juce::Font getComboBoxFont (juce::ComboBox&) override;
};

} // namespace Rezo
