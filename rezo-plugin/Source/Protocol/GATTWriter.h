#pragma once
#include <juce_core/juce_core.h>
#include "GATTConstants.h"

// Text command builders — each returns the UTF-8 bytes to write to CHAR_CMD.
// Stateless and side-effect-free.

namespace Rezo::GATT
{
    // "START" or "STOP"
    juce::MemoryBlock buildTransportCmd (bool isPlaying);

    // "BPM:<20-300>"
    juce::MemoryBlock buildBPMCmd (double bpm);

    // "TS:<num>/<den>"  e.g. "TS:4/4", "TS:3/4"
    juce::MemoryBlock buildTSCmd (uint8_t beats, uint8_t unit);

    // "PATTERN:<name>"  e.g. "PATTERN:PULSE"
    juce::MemoryBlock buildPatternCmd (uint8_t patternIdx);

    // "MODE:<name>"  e.g. "MODE:MIDI_CLOCK"
    juce::MemoryBlock buildModeCmd (juce::String mode);

    // "SIDE:<name>"  e.g. "SIDE:ALTERNATE"
    juce::MemoryBlock buildSideCmd (bool alternateSides);

    // "POLY:<left>:<right>"  0 means "follow the time signature beat count"
    juce::MemoryBlock buildPolyrhythmCmd (uint8_t leftPulses, uint8_t rightPulses);

} // namespace Rezo::GATT
