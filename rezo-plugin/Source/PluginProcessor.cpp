#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "Helper/HelperTransport.h"
#include "Protocol/GATTConstants.h"
#include <cmath>

namespace Rezo
{

RezoProcessor::RezoProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "RezoState", createParameterLayout())
{
    bleManager = std::make_unique<BLEManager> (createHelperTransport());
    bleManager->onStateChangedSecondary = [safeThis = juce::WeakReference<RezoProcessor> { this }] (ConnectionState state) mutable {
        if (safeThis != nullptr)
            safeThis->handleBLEStateChange (state);
    };

    apvts.addParameterListener (ParamIDs::VIBRATION_PRESET,    this);
    apvts.addParameterListener (ParamIDs::SIDE_MODE,           this);
    apvts.addParameterListener (ParamIDs::POLY_LEFT,           this);
    apvts.addParameterListener (ParamIDs::POLY_RIGHT,          this);
    apvts.addParameterListener (ParamIDs::TIMESIG_OVERRIDE,    this);
    apvts.addParameterListener (ParamIDs::TIMESIG_NUMERATOR,   this);
    apvts.addParameterListener (ParamIDs::TIMESIG_DENOMINATOR, this);

    pushPatternCmd (static_cast<int> (
        apvts.getRawParameterValue (ParamIDs::VIBRATION_PRESET)->load()));
    pushSideModeCmd (static_cast<int> (
        apvts.getRawParameterValue (ParamIDs::SIDE_MODE)->load()));
    pushPolyrhythmCmd (
        static_cast<int> (apvts.getRawParameterValue (ParamIDs::POLY_LEFT)->load()),
        static_cast<int> (apvts.getRawParameterValue (ParamIDs::POLY_RIGHT)->load()));
}

RezoProcessor::~RezoProcessor()
{
    apvts.removeParameterListener (ParamIDs::VIBRATION_PRESET,    this);
    apvts.removeParameterListener (ParamIDs::SIDE_MODE,           this);
    apvts.removeParameterListener (ParamIDs::POLY_LEFT,           this);
    apvts.removeParameterListener (ParamIDs::POLY_RIGHT,          this);
    apvts.removeParameterListener (ParamIDs::TIMESIG_OVERRIDE,    this);
    apvts.removeParameterListener (ParamIDs::TIMESIG_NUMERATOR,   this);
    apvts.removeParameterListener (ParamIDs::TIMESIG_DENOMINATOR, this);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

bool RezoProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto input  = layouts.getMainInputChannelSet();
    const auto output = layouts.getMainOutputChannelSet();

    if (input.isDisabled() || output.isDisabled() || input != output)
        return false;

    return input == juce::AudioChannelSet::mono()
        || input == juce::AudioChannelSet::stereo();
}

void RezoProcessor::prepareToPlay (double sampleRate, int /*samplesPerBlock*/)
{
    currentSampleRate = sampleRate;
    clockGen.reset();
    lastIsPlaying = false;
    transportArmed = false;
    lastBPM       = 0.0;
    lastBeats     = 0;
    lastBeatUnit  = 0;
    lastTimeInSamples = 0;

    juce::MessageManager::callAsync ([safeThis = juce::WeakReference<RezoProcessor> { this }]() mutable {
        if (safeThis == nullptr || safeThis->bleManager == nullptr)
            return;

        auto state = safeThis->apvts.state.getChildWithName ("Extra");
        juce::String cachedUUID;
        if (state.isValid())
            cachedUUID = state.getProperty (StateKeys::DEVICE_UUID).toString();

        safeThis->bleManager->startConnecting (cachedUUID);
    });
}

void RezoProcessor::releaseResources() {}

// ── processBlock — audio thread ───────────────────────────────────────────────

void RezoProcessor::processBlock (juce::AudioBuffer<float>& audio,
                                   juce::MidiBuffer& midi)
{
    const int numSamples = juce::jmax (audio.getNumSamples(), 1);

    // ── Poll playhead ─────────────────────────────────────────────────────────
    double  bpm         = 120.0;
    bool    isPlaying   = false;
    int64_t timeInSamps = 0;
    int     beats       = 4;
    int     beatUnit    = 4;

    if (auto* ph = getPlayHead())
    {
        if (auto pos = ph->getPosition())
        {
            if (pos->getBpm().hasValue())
                bpm = *pos->getBpm();
            isPlaying   = pos->getIsPlaying();
            if (pos->getTimeInSamples().hasValue())
                timeInSamps = *pos->getTimeInSamples();
            if (pos->getTimeSignature().hasValue())
            {
                beats    = pos->getTimeSignature()->numerator;
                beatUnit = pos->getTimeSignature()->denominator;
            }
        }
    }

    dawBPM.store      (bpm,      std::memory_order_relaxed);
    dawBeats.store    (beats,    std::memory_order_relaxed);
    dawBeatUnit.store (beatUnit, std::memory_order_relaxed);

    // ── MIDI clock generation ─────────────────────────────────────────────────
    clockGen.process (midi, numSamples, bpm, currentSampleRate, timeInSamps, isPlaying);

    // ── BLE change detection → push commands (wait-free) ─────────────────────
    lastTimeInSamples.store (timeInSamps, std::memory_order_relaxed);
    bool bpmChanged  = std::abs (bpm - lastBPM.load (std::memory_order_relaxed)) > 0.05;

    bool manualTS = static_cast<bool> (
        apvts.getRawParameterValue (ParamIDs::TIMESIG_OVERRIDE)->load (std::memory_order_relaxed));

    int effectiveBeats, effectiveBeatUnit;
    if (manualTS)
    {
        effectiveBeats    = static_cast<int> (
            apvts.getRawParameterValue (ParamIDs::TIMESIG_NUMERATOR)->load (std::memory_order_relaxed));
        int denomChoice = static_cast<int> (
            apvts.getRawParameterValue (ParamIDs::TIMESIG_DENOMINATOR)->load (std::memory_order_relaxed));
        effectiveBeatUnit = (denomChoice == 0) ? 4 : 8;
    }
    else
    {
        effectiveBeats    = beats;
        effectiveBeatUnit = beatUnit;
    }

    bool tsChanged = (effectiveBeats    != lastBeats.load (std::memory_order_relaxed) ||
                      effectiveBeatUnit != lastBeatUnit.load (std::memory_order_relaxed));

    if (! transportArmed.load (std::memory_order_relaxed))
    {
        lastIsPlaying.store (isPlaying, std::memory_order_relaxed);
        if (! isPlaying)
            transportArmed.store (true, std::memory_order_relaxed);
    }
    else if (isPlaying != lastIsPlaying.load (std::memory_order_relaxed))
    {
        lastIsPlaying.store (isPlaying, std::memory_order_relaxed);
        BLECommand cmd;
        cmd.type  = BLECommand::Type::Transport;
        cmd.byte0 = isPlaying ? 1 : 0;
        bleManager->pushCommand (cmd);
    }

    if (bpmChanged)
    {
        lastBPM.store (bpm, std::memory_order_relaxed);
        BLECommand cmd;
        cmd.type     = BLECommand::Type::BPM;
        cmd.floatVal = bpm;
        bleManager->pushCommand (cmd);
    }

    if (tsChanged)
    {
        lastBeats.store    (effectiveBeats,    std::memory_order_relaxed);
        lastBeatUnit.store (effectiveBeatUnit, std::memory_order_relaxed);
        BLECommand cmd;
        cmd.type  = BLECommand::Type::TimeSignature;
        cmd.byte0 = static_cast<uint8_t> (effectiveBeats);
        cmd.byte1 = static_cast<uint8_t> (effectiveBeatUnit);
        bleManager->pushCommand (cmd);
    }

    // ── Flush pending pattern change (set by message thread) ─────────────────
    if (patternDirty.exchange (false, std::memory_order_acq_rel))
    {
        BLECommand cmd;
        cmd.type  = BLECommand::Type::Pattern;
        cmd.byte0 = pendingPattern.load (std::memory_order_relaxed);
        bleManager->pushCommand (cmd);
    }

    if (sideModeDirty.exchange (false, std::memory_order_acq_rel))
    {
        BLECommand cmd;
        cmd.type  = BLECommand::Type::SideMode;
        cmd.byte0 = pendingSideMode.load (std::memory_order_relaxed);
        bleManager->pushCommand (cmd);
    }

    if (polyrhythmDirty.exchange (false, std::memory_order_acq_rel))
    {
        BLECommand cmd;
        cmd.type  = BLECommand::Type::Polyrhythm;
        cmd.byte0 = pendingPolyLeft.load (std::memory_order_relaxed);
        cmd.byte1 = pendingPolyRight.load (std::memory_order_relaxed);
        bleManager->pushCommand (cmd);
    }
}

// ── Parameter listener (message thread) ──────────────────────────────────────

void RezoProcessor::parameterChanged (const juce::String& paramID, float newValue)
{
    if (paramID == ParamIDs::VIBRATION_PRESET)
    {
        pushPatternCmd (static_cast<int> (newValue));
    }
    else if (paramID == ParamIDs::SIDE_MODE)
    {
        pushSideModeCmd (static_cast<int> (newValue));
    }
    else if (paramID == ParamIDs::POLY_LEFT || paramID == ParamIDs::POLY_RIGHT)
    {
        pushPolyrhythmCmd (
            static_cast<int> (apvts.getRawParameterValue (ParamIDs::POLY_LEFT)->load (std::memory_order_relaxed)),
            static_cast<int> (apvts.getRawParameterValue (ParamIDs::POLY_RIGHT)->load (std::memory_order_relaxed)));
    }
    else if (paramID == ParamIDs::TIMESIG_OVERRIDE ||
             paramID == ParamIDs::TIMESIG_NUMERATOR ||
             paramID == ParamIDs::TIMESIG_DENOMINATOR)
    {
        // Force a time sig push on next processBlock by invalidating the last values
        lastBeats.store    (0, std::memory_order_relaxed);
        lastBeatUnit.store (0, std::memory_order_relaxed);
    }
}

void RezoProcessor::pushPatternCmd (int patternIndex)
{
    uint8_t firmwarePattern = 15; // Strong

    switch (juce::jlimit (0, 3, patternIndex))
    {
        case 0: firmwarePattern = 15; break; // STRONG_CLICK
        case 1: firmwarePattern = 12; break; // SOFT_CLICK
        case 2: firmwarePattern = 3;  break; // SHARP
        case 3: firmwarePattern = 8;  break; // BUZZ_HOLD
        default: break;
    }

    pendingPattern.store (firmwarePattern, std::memory_order_relaxed);
    patternDirty.store (true, std::memory_order_release);
}

void RezoProcessor::pushSideModeCmd (int sideModeIndex)
{
    pendingSideMode.store (static_cast<uint8_t> (juce::jlimit (0, 1, sideModeIndex)),
                           std::memory_order_relaxed);
    sideModeDirty.store (true, std::memory_order_release);
}

void RezoProcessor::pushPolyrhythmCmd (int leftPulses, int rightPulses)
{
    pendingPolyLeft.store (static_cast<uint8_t> (juce::jlimit (0, 8, leftPulses)),
                           std::memory_order_relaxed);
    pendingPolyRight.store (static_cast<uint8_t> (juce::jlimit (0, 8, rightPulses)),
                            std::memory_order_relaxed);
    polyrhythmDirty.store (true, std::memory_order_release);
}

void RezoProcessor::handleBLEStateChange (ConnectionState state)
{
    if (state == ConnectionState::Connected)
    {
        transportArmed.store (false, std::memory_order_relaxed);
        lastIsPlaying.store (false, std::memory_order_relaxed);

        BLECommand cmd;
        cmd.type  = BLECommand::Type::Mode;
        cmd.byte0 = 1; // MIDI_CLOCK
        bleManager->pushCommand (cmd);
    }
}

// ── State save/restore ────────────────────────────────────────────────────────

void RezoProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();

    auto extra = state.getOrCreateChildWithName ("Extra", nullptr);
    extra.setProperty (StateKeys::STATE_VERSION, StateKeys::VERSION_VALUE, nullptr);
    extra.setProperty (StateKeys::DEVICE_UUID,
                       bleManager->getDeviceUUID(), nullptr);

    juce::MemoryOutputStream stream (destData, false);
    state.writeToStream (stream);
}

void RezoProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    auto state = juce::ValueTree::readFromData (data,
        static_cast<size_t> (sizeInBytes));
    if (state.isValid())
        apvts.replaceState (state);

    // Re-apply pattern from restored state
    int patternIdx = static_cast<int> (
        apvts.getRawParameterValue (ParamIDs::VIBRATION_PRESET)->load());
    pushPatternCmd (patternIdx);
    pushSideModeCmd (static_cast<int> (
        apvts.getRawParameterValue (ParamIDs::SIDE_MODE)->load()));
    pushPolyrhythmCmd (
        static_cast<int> (apvts.getRawParameterValue (ParamIDs::POLY_LEFT)->load()),
        static_cast<int> (apvts.getRawParameterValue (ParamIDs::POLY_RIGHT)->load()));
}

// ── Editor ────────────────────────────────────────────────────────────────────

juce::AudioProcessorEditor* RezoProcessor::createEditor()
{
    return new RezoEditor (*this);
}

} // namespace Rezo

// ── JUCE plugin entry point ───────────────────────────────────────────────────

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new Rezo::RezoProcessor();
}
