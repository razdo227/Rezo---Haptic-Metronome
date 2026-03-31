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

    // Canonical pattern names — index and order must match PATTERN_NAMES[] in firmware.
    static constexpr const char* PATTERN_NAMES[] = {
        "CLICK", "PULSE", "SOFT_BUMP", "SHARP", "DOUBLE", "TRIPLET",
        "RAMP_UP", "RAMP_DOWN", "BUZZ_HOLD", "THUD", "HEARTBEAT",
        "LONG_BUZZ", "SOFT_CLICK", "POPS", "TRANSITION_HUM", "STRONG_CLICK"
    };
    static constexpr int PATTERN_COUNT = 16;

    // Plugin UI preset → firmware pattern index.
    // The 7 presets mirror the mobile app's PATTERNS list (same display names, same order).
    // Preset index: 0=Soft Click, 1=Click, 2=Sharp, 3=Pulse, 4=Soft Bump, 5=Accent, 6=Thud
    static constexpr uint8_t PLUGIN_PRESET_TO_FIRMWARE[] = {
        12, // 0 "Soft Click"  → SOFT_CLICK  (firmware idx 12)
         0, // 1 "Click"       → CLICK       (firmware idx  0)
         3, // 2 "Sharp"       → SHARP       (firmware idx  3)
         1, // 3 "Pulse"       → PULSE       (firmware idx  1)
         2, // 4 "Soft Bump"   → SOFT_BUMP   (firmware idx  2)
        15, // 5 "Accent"      → STRONG_CLICK(firmware idx 15)
         9, // 6 "Thud"        → THUD        (firmware idx  9)
    };
    static constexpr int PLUGIN_PRESET_COUNT = 7;

} // namespace Rezo::GATT
