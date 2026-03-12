# Arduino Firmware Setup (XIAO nRF52840 + DRV2605)

## Folder
- Sketch: `RezoHaptic/RezoHaptic.ino`

## Arduino IDE setup

1. Install board support for **Seeed nRF52 Boards** (XIAO nRF52840).
2. Install libraries:
   - `ArduinoBLE`
   - `Adafruit DRV2605 Library`
3. Board/port:
   - Board: **Seeed XIAO nRF52840**
   - Select correct USB port
4. Upload sketch.

If upload fails, double-tap reset on XIAO to enter bootloader mode, then upload again.

## BLE protocol (text commands)
Write to command characteristic:

- `START`
- `STOP`
- `BPM:120`
- `MODE:INTERNAL`
- `MODE:MIDI_CLOCK`
- `MODE:MIDI_BEAT`
- `VIB:SOFT`
- `VIB:PULSE`
- `VIB:SHARP`
- `BEAT` (manual external beat event for testing in MIDI_BEAT mode)
- `PING`

Status notify examples:
- `run=1;bpm=120;mode=INTERNAL;vib=PULSE`
- `PONG`

## Notes
- v0.1 uses text commands for easy debugging.
- Next step is binary packet + final UUIDs + app-side BLE mapping.
- `MIDI_CLOCK` mode currently uses internal scheduler with external mode selection placeholder.
