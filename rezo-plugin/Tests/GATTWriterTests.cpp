#include <catch2/catch_test_macros.hpp>
#include "Protocol/GATTWriter.h"

using namespace Rezo::GATT;

namespace
{
juce::String toString (const juce::MemoryBlock& block)
{
    return juce::String::fromUTF8 (static_cast<const char*> (block.getData()),
                                   static_cast<int> (block.getSize()));
}
}

TEST_CASE ("buildTransportCmd emits text commands", "[GATTWriter]")
{
    REQUIRE (toString (buildTransportCmd (true)) == "START");
    REQUIRE (toString (buildTransportCmd (false)) == "STOP");
}

TEST_CASE ("buildBPMCmd clamps and rounds", "[GATTWriter]")
{
    REQUIRE (toString (buildBPMCmd (120.0)) == "BPM:120");
    REQUIRE (toString (buildBPMCmd (120.6)) == "BPM:121");
    REQUIRE (toString (buildBPMCmd (10.0)) == "BPM:20");
    REQUIRE (toString (buildBPMCmd (999.0)) == "BPM:300");
}

TEST_CASE ("buildTSCmd emits numerator and denominator", "[GATTWriter]")
{
    REQUIRE (toString (buildTSCmd (4, 4)) == "TS:4/4");
    REQUIRE (toString (buildTSCmd (7, 8)) == "TS:7/8");
}

TEST_CASE ("buildPatternCmd emits firmware pattern names", "[GATTWriter]")
{
    REQUIRE (toString (buildPatternCmd (15)) == "PATTERN:STRONG_CLICK");
    REQUIRE (toString (buildPatternCmd (12)) == "PATTERN:SOFT_CLICK");
    REQUIRE (toString (buildPatternCmd (99)) == "PATTERN:PULSE");
}

TEST_CASE ("new rhythm commands encode to firmware text protocol", "[GATTWriter]")
{
    REQUIRE (toString (buildModeCmd ("midi_clock")) == "MODE:MIDI_CLOCK");
    REQUIRE (toString (buildSideCmd (false)) == "SIDE:UNISON");
    REQUIRE (toString (buildSideCmd (true)) == "SIDE:ALTERNATE");
    REQUIRE (toString (buildPolyrhythmCmd (0, 3)) == "POLY:0:3");
}
