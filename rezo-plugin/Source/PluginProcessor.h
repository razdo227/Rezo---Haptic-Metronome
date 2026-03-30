#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "PluginParameters.h"
#include "MidiClockGenerator.h"
#include "BLE/BLEManager.h"
#include <atomic>
#include <memory>

namespace Rezo
{

class RezoProcessor : public juce::AudioProcessor,
                      public juce::AudioProcessorValueTreeState::Listener
{
public:
    RezoProcessor();
    ~RezoProcessor() override;

    // ── AudioProcessor ────────────────────────────────────────────────────────
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Rezo"; }
    bool acceptsMidi() const override  { return true; }
    bool producesMidi() const override { return true; }
    bool isMidiEffect() const override { return true; }
    double getTailLengthSeconds() const override { return 0.0; }

    int  getNumPrograms() override    { return 1; }
    int  getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return "Default"; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // ── APVTS parameter change listener ──────────────────────────────────────
    void parameterChanged (const juce::String& paramID, float newValue) override;

    // ── Accessors for the editor ──────────────────────────────────────────────
    juce::AudioProcessorValueTreeState& getAPVTS() { return apvts; }
    BLEManager& getBLEManager() { return *bleManager; }

    // Exposes last DAW BPM and time sig for the editor display
    std::atomic<double> dawBPM      { 120.0 };
    std::atomic<int>    dawBeats    { 4 };
    std::atomic<int>    dawBeatUnit { 4 };

private:
    juce::AudioProcessorValueTreeState apvts;
    MidiClockGenerator                 clockGen;
    std::unique_ptr<BLEManager>        bleManager;

    // Shadow state on audio thread (std::atomic) for change detection
    std::atomic<bool>    lastIsPlaying  { false };
    std::atomic<bool>    transportArmed { false };
    std::atomic<double>  lastBPM        { 0.0 };
    std::atomic<int>     lastBeats      { 0 };
    std::atomic<int>     lastBeatUnit   { 0 };
    std::atomic<int64_t> lastTimeInSamples { 0 };

    double currentSampleRate { 44100.0 };

    // Queued pattern change from APVTS listener (message thread → audio thread)
    std::atomic<bool>    patternDirty   { false };
    std::atomic<uint8_t> pendingPattern { 15 };  // default: STRONG_CLICK
    std::atomic<bool>    sideModeDirty  { false };
    std::atomic<uint8_t> pendingSideMode { 0 };  // 0=UNISON, 1=ALTERNATE
    std::atomic<bool>    polyrhythmDirty { false };
    std::atomic<uint8_t> pendingPolyLeft  { 0 }; // 0=follow beat count
    std::atomic<uint8_t> pendingPolyRight { 0 };

    void pushPatternCmd (int patternIndex);
    void pushSideModeCmd (int sideModeIndex);
    void pushPolyrhythmCmd (int leftPulses, int rightPulses);
    void handleBLEStateChange (ConnectionState state);

    JUCE_DECLARE_WEAK_REFERENCEABLE (RezoProcessor)
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RezoProcessor)
};

} // namespace Rezo
