#include "MidiClockGenerator.h"
#include <cmath>

namespace Rezo
{

static constexpr double PPQ = 24.0; // MIDI spec: 24 pulses per quarter note

void MidiClockGenerator::process (juce::MidiBuffer& midiOut,
                                   int              numSamples,
                                   double           bpm,
                                   double           sampleRate,
                                   int64_t          timeInSamples,
                                   bool             isPlaying)
{
    // ── Transport messages ─────────────────────────────────────────────────────
    if (isPlaying && !wasPlaying)
    {
        // Determine Start vs Continue based on playhead position.
        // Position 0 = fresh start; anything else = mid-song resume.
        bool atStart = (timeInSamples == 0);
        auto msg = atStart ? juce::MidiMessage::midiStart()
                           : juce::MidiMessage::midiContinue();
        midiOut.addEvent (msg, 0);

        // Recalculate tick duration and snap next tick to playhead
        tickDuration    = (60.0 / bpm / PPQ) * sampleRate;
        double position = static_cast<double> (timeInSamples);
        // First tick at or just after the current position
        nextTickPosition = (tickDuration > 0.0)
            ? std::ceil (position / tickDuration) * tickDuration
            : position;

        everStarted = true;
    }
    else if (!isPlaying && wasPlaying)
    {
        midiOut.addEvent (juce::MidiMessage::midiStop(), 0);
    }

    wasPlaying = isPlaying;

    if (!isPlaying) return;

    // ── Clock ticks ───────────────────────────────────────────────────────────
    // Recalculate tick duration each block to handle tempo automation.
    tickDuration = (60.0 / bpm / PPQ) * sampleRate;
    if (tickDuration <= 0.0) return;

    double blockStart = static_cast<double> (timeInSamples);
    double blockEnd   = blockStart + static_cast<double> (numSamples);

    while (nextTickPosition < blockEnd)
    {
        if (nextTickPosition >= blockStart)
        {
            int offset = static_cast<int> (nextTickPosition - blockStart);
            offset = juce::jlimit (0, numSamples - 1, offset);
            midiOut.addEvent (juce::MidiMessage::midiClock(), offset);
        }
        nextTickPosition += tickDuration;
    }
}

void MidiClockGenerator::reset()
{
    wasPlaying       = false;
    everStarted      = false;
    tickDuration     = 0.0;
    nextTickPosition = 0.0;
}

} // namespace Rezo
