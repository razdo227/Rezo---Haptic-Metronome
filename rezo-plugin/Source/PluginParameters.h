#pragma once
#include <juce_audio_processors/juce_audio_processors.h>

namespace Rezo
{

// Parameter IDs — used by APVTS and UI attachments
struct ParamIDs
{
    static constexpr auto VIBRATION_PRESET    = "vibration_preset"; // 0-3, user-facing vibration type
    static constexpr auto SIDE_MODE           = "side_mode";        // 0=both, 1=alternate
    static constexpr auto POLY_LEFT           = "poly_left";        // 0=auto, 1-8 pulses per bar
    static constexpr auto POLY_RIGHT          = "poly_right";       // 0=auto, 1-8 pulses per bar
    static constexpr auto TIMESIG_OVERRIDE    = "timesig_override"; // false=DAW, true=Manual
    static constexpr auto TIMESIG_NUMERATOR   = "timesig_numerator";
    static constexpr auto TIMESIG_DENOMINATOR = "timesig_denominator"; // 0=quarter, 1=eighth
};

// Non-parameter state keys stored in getStateInformation XML
struct StateKeys
{
    static constexpr auto DEVICE_UUID    = "last_device_uuid";
    static constexpr auto STATE_VERSION  = "state_version";
    static constexpr auto VERSION_VALUE  = "1";
};

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

} // namespace Rezo
