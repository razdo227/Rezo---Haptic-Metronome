# Firmware (nRF52840)

v0.1 firmware scaffold for Rezo haptic metronome.

## Goals
- Device is clock master by default (`INTERNAL` mode)
- Optional sync modes:
  - `MIDI_CLOCK_FOLLOW`
  - `MIDI_BEAT_TRIGGER`
- BLE command channel (next step: wire real GATT service)
- Deterministic transport scheduler foundation

## Current contents
- `src/main.c`: boot loop + scheduler tick + sync mode state machine skeleton
- `src/sync_mode.h`: mode/event enums + runtime structs
- `src/sync_mode.c`: mode transitions + beat-timeout guard

## Planned next implementation
1. Add BLE GATT service/characteristics for:
   - set tempo
   - set transport state
   - set sync mode
   - status notify
2. Add hardware timer-backed scheduler on nRF
3. Add DRV2605L I2C driver integration and pulse rendering
4. Add MIDI event ingest path and map to sync runtime
