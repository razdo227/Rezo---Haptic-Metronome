#include "BeatLEDs.h"
#include "RezoLookAndFeel.h"

namespace Rezo
{

BeatLEDs::BeatLEDs()
{
    startTimerHz (30); // 30fps fade
}

void BeatLEDs::setBeats (int n)
{
    numBeats = juce::jlimit (2, 7, n);
    repaint();
}

void BeatLEDs::setCurrentBeat (uint8_t beat)
{
    activeBeat  = static_cast<int> (beat);
    activeAlpha = 1.0f;
    repaint();
}

void BeatLEDs::timerCallback()
{
    if (activeAlpha > 0.15f)
    {
        activeAlpha -= 0.05f;
        repaint();
    }
}

void BeatLEDs::paint (juce::Graphics& g)
{
    const float dotR    = 8.0f;
    const float spacing = 28.0f;
    const float totalW  = numBeats * spacing - (spacing - dotR * 2);
    float startX        = (getWidth() - totalW) * 0.5f;
    const float cy      = getHeight() * 0.5f;

    for (int i = 0; i < numBeats; ++i)
    {
        float cx = startX + i * spacing + dotR;

        bool isDownbeat = (i == 0);
        bool isActive   = (i == activeBeat);

        juce::Colour baseColor = isDownbeat
            ? juce::Colour (Colors::AccentBlue)
            : juce::Colour (Colors::Border);

        if (isActive)
        {
            // Glow ring
            g.setColour (baseColor.withAlpha (activeAlpha * 0.3f));
            g.fillEllipse (cx - dotR * 1.8f, cy - dotR * 1.8f,
                           dotR * 3.6f, dotR * 3.6f);
            // Filled dot
            g.setColour (baseColor.withAlpha (0.5f + activeAlpha * 0.5f));
            g.fillEllipse (cx - dotR, cy - dotR, dotR * 2, dotR * 2);
        }
        else
        {
            g.setColour (baseColor.withAlpha (isDownbeat ? 0.8f : 0.3f));
            g.fillEllipse (cx - dotR, cy - dotR, dotR * 2, dotR * 2);
        }
    }
}

} // namespace Rezo
