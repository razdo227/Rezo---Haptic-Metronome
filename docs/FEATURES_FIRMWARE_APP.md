# Rezo v1 Features (Firmware + App)

## Core timing
- BPM: 20-300
- Time signatures + subdivisions
- Accent patterns
- Start/Stop/Count-in
- Tap tempo (button and app)

## nRF52840 Sense mic feature
- **Mic-based tap tempo detection**:
  - Onset detector from on-board mic
  - Peak + energy thresholding
  - Inter-onset interval averaging
  - Outlier rejection and confidence score
  - Optional noise gate for rehearsal/stage environments

## Haptic engine
- Intensity control
- Pulse envelope profiles — 16 named patterns (CLICK, PULSE, SHARP, SOFT_BUMP, THUD, STRONG_CLICK, …)
- Left/right motor routing modes (UNISON / ALTERNATE)
- Latency offset calibration
- DRV2605L LRA mode: auto-calibration on boot (`autoCalibrate()`), RATED_VOLTAGE + OD_CLAMP tuned for Vybronics VLV101040A (1.8 V / 2.25 V overdrive)
- Motor gate: software cutoff per pattern to prevent inter-beat smear
- Downbeat accent: all patterns use a distinct heavy-click waveform on beat 1

## Cross-platform pattern parity
- 16 canonical pattern IDs in firmware (`PATTERN_NAMES[]`) — authoritative for all platforms
- Mobile app exposes 7 user-facing patterns with display names matching plugin presets exactly
- Plugin presets (7 choices) mapped to firmware indices via `GATTConstants::PLUGIN_PRESET_TO_FIRMWARE[]`
- Mobile `COMMANDS` helper covers all protocol verbs: BPM, TS, PATTERN, MODE, SIDE, POLY

## MIDI / click support
- MIDI Clock slave sync
- MIDI Start/Stop/Continue
- Song Position Pointer handling
- MIDI click mapping to haptic patterns

## BLE + app control
- Pair/bond
- Real-time command channel (tempo/transport/intensity)
- Device status stream (beat, bar, battery, fw version)
- Presets/setlists

## Reliability
- Low-jitter scheduler
- Watchdog + recovery
- NVM settings storage
- Event logging for study analysis
