#include <catch2/catch_test_macros.hpp>
#include "MidiClockGenerator.h"

using namespace Rezo;

// Helper: count messages of a given raw status byte in a MidiBuffer
static int countMessages (const juce::MidiBuffer& buf, uint8_t statusByte)
{
    int count = 0;
    for (const auto meta : buf)
        if (meta.getMessage().getRawData()[0] == statusByte)
            ++count;
    return count;
}

static constexpr double BPM        = 120.0;
static constexpr double SAMPLE_RATE = 44100.0;
// At 120 BPM: 24 ticks/beat × 2 beats/sec = 48 ticks/sec
// Tick duration = 44100 / 48 = 918.75 samples
// Over 1 second (44100 samples): expect 48 ticks
static constexpr int BLOCK_SIZE = 44100;

TEST_CASE ("MidiClockGenerator — tick count at 120 BPM", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;

    gen.process (out, BLOCK_SIZE, BPM, SAMPLE_RATE, 0, true);

    // Should have: 1 midiStart (0xFA) + 48 midiClock (0xF8) ticks
    int clocks = countMessages (out, 0xF8);
    int starts = countMessages (out, 0xFA);

    REQUIRE (starts == 1);
    // Allow ±1 for rounding at block boundary
    REQUIRE (clocks >= 47);
    REQUIRE (clocks <= 49);
}

TEST_CASE ("MidiClockGenerator — midiStart at position 0", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;
    gen.process (out, 512, BPM, SAMPLE_RATE, 0, true);
    REQUIRE (countMessages (out, 0xFA) == 1); // Start
    REQUIRE (countMessages (out, 0xFB) == 0); // NOT Continue
}

TEST_CASE ("MidiClockGenerator — midiContinue when not at position 0", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;
    // Simulate playhead mid-song (10 seconds in)
    gen.process (out, 512, BPM, SAMPLE_RATE, 441000, true);
    REQUIRE (countMessages (out, 0xFB) == 1); // Continue
    REQUIRE (countMessages (out, 0xFA) == 0); // NOT Start
}

TEST_CASE ("MidiClockGenerator — midiStop on transport stop", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;

    // Start playing
    gen.process (out, 512, BPM, SAMPLE_RATE, 0, true);
    out.clear();

    // Stop
    gen.process (out, 512, BPM, SAMPLE_RATE, 512, false);
    REQUIRE (countMessages (out, 0xFC) == 1); // Stop
    REQUIRE (countMessages (out, 0xF8) == 0); // No clock ticks when stopped
}

TEST_CASE ("MidiClockGenerator — no ticks when stopped", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;
    gen.process (out, BLOCK_SIZE, BPM, SAMPLE_RATE, 0, false);
    REQUIRE (countMessages (out, 0xF8) == 0);
}

TEST_CASE ("MidiClockGenerator — tempo change adjusts tick rate", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;

    // 240 BPM: 24 × 4 = 96 ticks/sec over 44100 samples
    gen.process (out, BLOCK_SIZE, 240.0, SAMPLE_RATE, 0, true);
    int clocks = countMessages (out, 0xF8);
    REQUIRE (clocks >= 95);
    REQUIRE (clocks <= 97);
}

TEST_CASE ("MidiClockGenerator — start not re-sent on subsequent blocks", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;

    gen.process (out, 512, BPM, SAMPLE_RATE, 0, true);
    REQUIRE (countMessages (out, 0xFA) == 1);
    out.clear();

    gen.process (out, 512, BPM, SAMPLE_RATE, 512, true);
    REQUIRE (countMessages (out, 0xFA) == 0); // No second Start
}

TEST_CASE ("MidiClockGenerator — reset clears state", "[MidiClockGenerator]")
{
    MidiClockGenerator gen;
    juce::MidiBuffer   out;

    gen.process (out, 512, BPM, SAMPLE_RATE, 0, true);
    out.clear();

    gen.reset();
    gen.process (out, 512, BPM, SAMPLE_RATE, 0, true);
    REQUIRE (countMessages (out, 0xFA) == 1); // Fresh Start after reset
}
