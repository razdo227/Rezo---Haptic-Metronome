#include "GATTWriter.h"
#include <algorithm>
#include <cmath>

namespace Rezo::GATT
{

static juce::MemoryBlock toBlock (const juce::String& s)
{
    return { s.toRawUTF8(), static_cast<size_t> (s.getNumBytesAsUTF8()) };
}

juce::MemoryBlock buildTransportCmd (bool isPlaying)
{
    return toBlock (isPlaying ? "START" : "STOP");
}

juce::MemoryBlock buildBPMCmd (double bpm)
{
    auto clamped = static_cast<int> (
        std::clamp (static_cast<int> (std::round (bpm)), (int)BPM_MIN, (int)BPM_MAX));
    return toBlock ("BPM:" + juce::String (clamped));
}

juce::MemoryBlock buildTSCmd (uint8_t beats, uint8_t unit)
{
    return toBlock ("TS:" + juce::String (beats) + "/" + juce::String (unit));
}

juce::MemoryBlock buildPatternCmd (uint8_t patternIdx)
{
    if (patternIdx >= static_cast<uint8_t> (PATTERN_COUNT))
        patternIdx = 1; // default to PULSE
    return toBlock ("PATTERN:" + juce::String (PATTERN_NAMES[patternIdx]));
}

juce::MemoryBlock buildModeCmd (juce::String mode)
{
    mode = mode.trim().toUpperCase();
    if (mode.isEmpty())
        mode = "INTERNAL";
    return toBlock ("MODE:" + mode);
}

juce::MemoryBlock buildSideCmd (bool alternateSides)
{
    return toBlock (alternateSides ? "SIDE:ALTERNATE" : "SIDE:UNISON");
}

juce::MemoryBlock buildPolyrhythmCmd (uint8_t leftPulses, uint8_t rightPulses)
{
    return toBlock ("POLY:" + juce::String (static_cast<int> (leftPulses))
                  + ":" + juce::String (static_cast<int> (rightPulses)));
}

} // namespace Rezo::GATT
