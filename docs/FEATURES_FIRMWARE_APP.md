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
- Pulse envelope profiles
- Left/right motor routing modes
- Latency offset calibration

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
