#pragma once
#include <juce_core/juce_core.h>
#include "../BLE/IBLETransport.h"

namespace Rezo::HelperProtocol
{
constexpr int kPort = 48731;
constexpr uint32_t kMagic = 0x527A4850; // "RzHP"

namespace Message
{
constexpr auto startScan   = "START_SCAN";
constexpr auto stopScan    = "STOP_SCAN";
constexpr auto connectUUID = "CONNECT_UUID";
constexpr auto disconnect  = "DISCONNECT";
constexpr auto subscribe   = "SUBSCRIBE_BEAT";
constexpr auto write       = "WRITE";

constexpr auto state       = "STATE";
constexpr auto found       = "FOUND";
constexpr auto deviceUUID  = "DEVICE_UUID";
constexpr auto rssi        = "RSSI";
constexpr auto beat        = "BEAT";
} // namespace Message

inline juce::MemoryBlock toMessageBlock (const juce::String& text)
{
    auto utf8 = text.toRawUTF8();
    return juce::MemoryBlock (utf8, std::strlen (utf8));
}

inline juce::String fromMessageBlock (const juce::MemoryBlock& block)
{
    return juce::String::fromUTF8 (static_cast<const char*> (block.getData()),
                                   static_cast<int> (block.getSize()));
}

inline juce::StringArray splitFields (const juce::String& text)
{
    return juce::StringArray::fromTokens (text, "\t", "");
}

inline juce::String joinFields (std::initializer_list<juce::String> fields)
{
    juce::StringArray parts;
    for (const auto& field : fields)
        parts.add (field);

    return parts.joinIntoString ("\t");
}

inline juce::String encodeHex (const juce::MemoryBlock& block)
{
    juce::String out;
    const auto* bytes = static_cast<const uint8_t*> (block.getData());

    for (size_t i = 0; i < block.getSize(); ++i)
        out << juce::String::toHexString ((int) bytes[i]).paddedLeft ('0', 2);

    return out;
}

inline juce::MemoryBlock decodeHex (const juce::String& hex)
{
    juce::MemoryBlock block;
    auto text = hex.trim();

    if ((text.length() % 2) != 0)
        return block;

    block.setSize ((size_t) text.length() / 2, false);
    auto* bytes = static_cast<uint8_t*> (block.getData());

    for (int i = 0; i < text.length(); i += 2)
        bytes[i / 2] = static_cast<uint8_t> (text.substring (i, i + 2).getHexValue32());

    return block;
}

inline juce::String connectionStateToString (ConnectionState state)
{
    switch (state)
    {
        case ConnectionState::Idle:         return "Idle";
        case ConnectionState::Scanning:     return "Scanning";
        case ConnectionState::Connecting:   return "Connecting";
        case ConnectionState::Connected:    return "Connected";
        case ConnectionState::Reconnecting: return "Reconnecting";
    }

    return "Idle";
}

inline ConnectionState connectionStateFromString (const juce::String& text)
{
    if (text == "Scanning")     return ConnectionState::Scanning;
    if (text == "Connecting")   return ConnectionState::Connecting;
    if (text == "Connected")    return ConnectionState::Connected;
    if (text == "Reconnecting") return ConnectionState::Reconnecting;
    return ConnectionState::Idle;
}
} // namespace Rezo::HelperProtocol
