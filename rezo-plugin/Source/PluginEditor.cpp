#include "PluginEditor.h"
#include "PluginProcessor.h"

namespace Rezo
{

RezoEditor::RezoEditor (RezoProcessor& proc)
    : AudioProcessorEditor (proc),
      processorRef (proc),
      vibrationPanel (proc.getAPVTS()),
      rhythmPanel    (proc.getAPVTS()),
      timeSigPanel   (proc.getAPVTS())
{
    setLookAndFeel (&laf);

    addAndMakeVisible (connectionPanel);
    addAndMakeVisible (transportDisplay);
    addAndMakeVisible (beatLEDs);
    addAndMakeVisible (vibrationPanel);
    addAndMakeVisible (rhythmPanel);
    addAndMakeVisible (timeSigPanel);

    // Wire BLEManager callbacks to UI updates (all on message thread)
    auto& ble = proc.getBLEManager();
    ble.onStateChanged = [safeThis = juce::Component::SafePointer<RezoEditor> (this)] (ConnectionState s) {
        if (safeThis == nullptr)
            return;

        auto& bleManager = safeThis->processorRef.getBLEManager();
        safeThis->connectionPanel.setState (s, bleManager.getDeviceUUID(), bleManager.getRSSI());
    };
    ble.onBeatReceived = [safeThis = juce::Component::SafePointer<RezoEditor> (this)] (uint8_t beat) {
        if (safeThis != nullptr)
            safeThis->beatLEDs.setCurrentBeat (beat);
    };

    setResizable (true, true);
    setResizeLimits (300, 460, 640, 920);
    setSize (340, 520);

    startTimerHz (10); // poll BPM/timesig from processor atomics at 10Hz
}

RezoEditor::~RezoEditor()
{
    setLookAndFeel (nullptr);
    // Clear callbacks so BLEManager doesn't call into a destroyed editor
    processorRef.getBLEManager().onStateChanged = nullptr;
    processorRef.getBLEManager().onBeatReceived = nullptr;
    stopTimer();
}

void RezoEditor::timerCallback()
{
    // Poll atomic display values from the processor (written by the audio thread)
    transportDisplay.setBPM     (processorRef.dawBPM.load (std::memory_order_relaxed));
    transportDisplay.setTimeSignature (
        processorRef.dawBeats.load    (std::memory_order_relaxed),
        processorRef.dawBeatUnit.load (std::memory_order_relaxed));
    beatLEDs.setBeats (processorRef.dawBeats.load (std::memory_order_relaxed));
}

void RezoEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (Colors::Background));

    // Subtle dividers between sections
    g.setColour (juce::Colour (Colors::Border));
    // (Dividers drawn via component positions; no hardcoded lines needed)
}

void RezoEditor::resized()
{
    auto b = getLocalBounds();

    // Connection panel: 44px tall at top
    connectionPanel.setBounds (b.removeFromTop (44));

    // 1px divider
    b.removeFromTop (1);

    // Transport display: ~30% of remaining height
    int remaining = b.getHeight();
    transportDisplay.setBounds (b.removeFromTop (remaining * 30 / 100));

    // Beat LEDs: 44px
    beatLEDs.setBounds (b.removeFromTop (44));

    b.removeFromTop (8);

    // Vibration panel
    int panelH = 88;
    vibrationPanel.setBounds (b.removeFromTop (panelH).reduced (8, 0));

    b.removeFromTop (8);

    rhythmPanel.setBounds (b.removeFromTop (panelH).reduced (8, 0));

    b.removeFromTop (8);

    // Time sig panel
    timeSigPanel.setBounds (b.removeFromTop (panelH).reduced (8, 0));
}

} // namespace Rezo
