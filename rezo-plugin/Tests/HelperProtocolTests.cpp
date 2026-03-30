#include <catch2/catch_test_macros.hpp>
#include "Helper/HelperProtocol.h"

TEST_CASE ("HelperProtocol hex round-trip", "[HelperProtocol]")
{
    juce::MemoryBlock block;
    const uint8_t bytes[] { 0x01, 0xab, 0xff, 0x10 };
    block.append (bytes, sizeof (bytes));

    const auto hex = Rezo::HelperProtocol::encodeHex (block);
    const auto decoded = Rezo::HelperProtocol::decodeHex (hex);

    REQUIRE (decoded == block);
}

TEST_CASE ("HelperProtocol connection state round-trip", "[HelperProtocol]")
{
    using Rezo::ConnectionState;

    REQUIRE (Rezo::HelperProtocol::connectionStateFromString ("Idle") == ConnectionState::Idle);
    REQUIRE (Rezo::HelperProtocol::connectionStateFromString ("Scanning") == ConnectionState::Scanning);
    REQUIRE (Rezo::HelperProtocol::connectionStateFromString ("Connecting") == ConnectionState::Connecting);
    REQUIRE (Rezo::HelperProtocol::connectionStateFromString ("Connected") == ConnectionState::Connected);
    REQUIRE (Rezo::HelperProtocol::connectionStateFromString ("Reconnecting") == ConnectionState::Reconnecting);
}
