#include "ConnectionPanel.h"
#include "RezoLookAndFeel.h"
#include <algorithm>

namespace Rezo
{

ConnectionPanel::ConnectionPanel()
{
    startTimerHz (2); // 500ms pulse for reconnecting state
}

void ConnectionPanel::setState (ConnectionState state,
                                 const juce::String& name, int rssiDBm)
{
    currentState = state;
    deviceName   = name;
    rssi         = rssiDBm;
    repaint();
}

void ConnectionPanel::timerCallback()
{
    if (currentState == ConnectionState::Reconnecting ||
        currentState == ConnectionState::Scanning)
    {
        dotPhase = !dotPhase;
        dotAlpha = dotPhase ? 1.0f : 0.3f;
        repaint();
    }
    else
    {
        dotAlpha = 1.0f;
    }
}

void ConnectionPanel::paint (juce::Graphics& g)
{
    auto bounds = getLocalBounds().toFloat();

    // Status dot (12×12)
    const float dotSize = 12.0f;
    const float dotX    = 12.0f;
    const float dotY    = bounds.getCentreY() - dotSize * 0.5f;

    juce::Colour dotColor;
    switch (currentState)
    {
        case ConnectionState::Idle:
            dotColor = juce::Colour (Colors::AccentRed);
            break;
        case ConnectionState::Connected:
            dotColor = juce::Colour (Colors::AccentGreen);
            break;
        case ConnectionState::Reconnecting:
        case ConnectionState::Scanning:
        case ConnectionState::Connecting:
            dotColor = juce::Colour (Colors::AccentAmber);
            break;
        default:
            dotColor = juce::Colour (Colors::AccentRed);
            break;
    }

    g.setColour (dotColor.withAlpha (dotAlpha));
    g.fillEllipse (dotX, dotY, dotSize, dotSize);

    // Device name / status text
    juce::String statusText;
    switch (currentState)
    {
        case ConnectionState::Idle:         statusText = "Not connected"; break;
        case ConnectionState::Connected:    statusText = deviceName; break;
        case ConnectionState::Scanning:     statusText = "Scanning..."; break;
        case ConnectionState::Connecting:   statusText = "Connecting..."; break;
        case ConnectionState::Reconnecting: statusText = "Reconnecting..."; break;
        default:                            statusText = "Not connected"; break;
    }

    g.setColour (juce::Colour (Colors::TextPrimary));
    g.setFont (juce::Font (juce::FontOptions().withHeight (15.0f)));
    g.drawText (statusText,
                (int)(dotX + dotSize + 8), 0,
                getWidth() - (int)(dotX + dotSize + 8) - 60, getHeight(),
                juce::Justification::centredLeft);

    // RSSI bar (only when connected)
    if (currentState == ConnectionState::Connected && rssi != 0)
    {
        // Map RSSI (-40 dBm=excellent to -90 dBm=weak) to 0–1
        float normalized = juce::jlimit (0.0f, 1.0f,
            (float)(rssi + 90) / 50.0f);

        const int barW  = 48;
        const int barH  = 6;
        const int barX  = getWidth() - barW - 8;
        const int barY  = (getHeight() - barH) / 2;

        g.setColour (juce::Colour (Colors::Border));
        g.fillRoundedRectangle ((float)barX, (float)barY,
                                (float)barW, (float)barH, 2.0f);

        juce::Colour barColor = normalized > 0.6f
            ? juce::Colour (Colors::AccentGreen)
            : normalized > 0.3f
                ? juce::Colour (Colors::AccentAmber)
                : juce::Colour (Colors::AccentRed);
        g.setColour (barColor);
        g.fillRoundedRectangle ((float)barX, (float)barY,
                                (float)barW * normalized, (float)barH, 2.0f);
    }
}

void ConnectionPanel::resized() {}

} // namespace Rezo
