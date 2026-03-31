#include "PluginParameters.h"
#include "Protocol/GATTConstants.h"

namespace Rezo
{

juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    // User-facing pattern labels — same names and order as the mobile app.
    // Index → firmware mapping lives in GATTConstants.h PLUGIN_PRESET_TO_FIRMWARE[].
    juce::StringArray patternNames { "Soft Click", "Click", "Sharp", "Pulse", "Soft Bump", "Accent", "Thud" };

    params.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { ParamIDs::VIBRATION_PRESET, 1 },
        "Pattern",
        patternNames,
        3)); // default: Pulse

    params.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { ParamIDs::SIDE_MODE, 1 },
        "Side Mode",
        juce::StringArray { "Both", "Alternate" },
        0));

    params.push_back (std::make_unique<juce::AudioParameterInt> (
        juce::ParameterID { ParamIDs::POLY_LEFT, 1 },
        "Left Pulses",
        0, 8, 0)); // 0 = follow current bar beat count

    params.push_back (std::make_unique<juce::AudioParameterInt> (
        juce::ParameterID { ParamIDs::POLY_RIGHT, 1 },
        "Right Pulses",
        0, 8, 0)); // 0 = follow current bar beat count

    // Time signature override: DAW sync (false) or Manual (true)
    params.push_back (std::make_unique<juce::AudioParameterBool> (
        juce::ParameterID { ParamIDs::TIMESIG_OVERRIDE, 1 },
        "Manual Time Sig",
        false));

    // Manual numerator: 2–7, default 4
    params.push_back (std::make_unique<juce::AudioParameterInt> (
        juce::ParameterID { ParamIDs::TIMESIG_NUMERATOR, 1 },
        "Beats",
        2, 7, 4));

    // Manual denominator: 0=quarter(4), 1=eighth(8)
    params.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { ParamIDs::TIMESIG_DENOMINATOR, 1 },
        "Note Value",
        juce::StringArray { "Quarter (4)", "Eighth (8)" },
        0));

    return { params.begin(), params.end() };
}

} // namespace Rezo
