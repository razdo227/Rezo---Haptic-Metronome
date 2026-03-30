#pragma once
#include <juce_audio_processors/juce_audio_processors.h>

namespace Rezo
{

// Generates sample-accurate MIDI clock messages (0xF8) inside processBlock().
//
// MIDI clock spec: 24 pulses per quarter note (PPQ).
// Also emits:
//   0xFA  midiStart    — on first Play from stopped/reset
//   0xFB  midiContinue — on Play after Stop (mid-song resume)
//   0xFC  midiStop     — on Stop
//
// All methods are called on the audio thread. No allocation, no JUCE strings,
// no locks. Uses only primitive types and the provided MidiBuffer.

class MidiClockGenerator
{
public:
    MidiClockGenerator() = default;

    // Call once per processBlock().
    //   midiOut      — output buffer to append clock messages into
    //   numSamples   — size of this block
    //   bpm          — current tempo (from AudioPlayHead)
    //   sampleRate   — current sample rate
    //   timeInSamples — playhead position at start of this block
    //   isPlaying    — DAW transport state
    void process (juce::MidiBuffer& midiOut,
                  int              numSamples,
                  double           bpm,
                  double           sampleRate,
                  int64_t          timeInSamples,
                  bool             isPlaying);

    void reset();

private:
    bool   wasPlaying        { false };
    bool   everStarted       { false }; // distinguish Start vs Continue
    double tickDuration      { 0.0 };   // samples per tick at current BPM/SR
    double nextTickPosition  { 0.0 };   // absolute sample position of next tick
};

} // namespace Rezo
