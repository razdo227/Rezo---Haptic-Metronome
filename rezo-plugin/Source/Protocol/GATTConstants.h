#pragma once
#include <cstdint>

// Mirror of the firmware's text-based BLE protocol.
// All commands are UTF-8 text written to CHAR_CMD.
// Status notifications arrive on CHAR_STATUS as UTF-8 key=value pairs.
//
// Keep in sync with:
//   firmware: RezoHaptic.ino (PATTERN_NAMES[], applyCommand())
//   mobile:   app/src/constants/ble.ts

namespace Rezo::GATT
{
    constexpr auto DEVICE_NAME  = "Rezo";
    constexpr auto SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
    constexpr auto CHAR_CMD     = "19b10001-e8f2-537e-4f6c-d104768a1214"; // host → device (write)
    constexpr auto CHAR_STATUS  = "19b10002-e8f2-537e-4f6c-d104768a1214"; // device → host (notify+read)

    constexpr uint16_t BPM_MIN = 20;
    constexpr uint16_t BPM_MAX = 300;

    // Pattern names — index and order must match PATTERN_NAMES[] in firmware.
    static constexpr const char* PATTERN_NAMES[] = {
        "CLICK", "PULSE", "SOFT_BUMP", "SHARP", "DOUBLE", "TRIPLET",
        "RAMP_UP", "RAMP_DOWN", "BUZZ_HOLD", "THUD", "HEARTBEAT",
        "LONG_BUZZ", "SOFT_CLICK", "POPS", "TRANSITION_HUM", "STRONG_CLICK"
    };
    static constexpr int PATTERN_COUNT = 16;

} // namespace Rezo::GATT
