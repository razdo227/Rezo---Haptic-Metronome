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

## New UX behavior (v0.3)

### 1) Pairing / advertising LED pattern
When the board is advertising and no BLE central is connected, the onboard LED shows:
- **double blink** (two short flashes)
- then pause
- repeating cycle

This gives a clear “ready to pair” visual state.

### 2) Startup haptic cue
On every boot, firmware now sends a **single vibration pulse** via DRV2605 as a power-on cue.

### 3) Mode scaffold retained
Mode handling remains compatible and explicit:
- `INTERNAL` = local BPM scheduler
- `MIDI_CLOCK` = currently uses the same local scheduler as a scaffold for future BLE MIDI clock tick integration
- `MIDI_BEAT` = external beat-trigger mode via `BEAT` command

## BLE protocol (text commands)
Write to command characteristic:

- `START`
- `STOP`
- `BPM:120`
- `MODE:INTERNAL`
- `MODE:MIDI_CLOCK`
- `MODE:MIDI_BEAT`
- `PATTERN:CLICK`
- `PATTERN:PULSE`
- `PATTERN:ACCENT`
- `PATTERN:DOUBLE`
- `PATTERN:TRIPLET`
- `PATTERN:RAMP_UP`
- `PATTERN:RAMP_DOWN`
- `PATTERN:BUZZ_HOLD`
- `VIB:...` (legacy alias, preserved for backward compatibility)
- `BEAT` (manual external beat event for testing in MIDI_BEAT mode)
- `PING`

Status notify examples:
- `run=1;bpm=120;mode=INTERNAL;pattern=PULSE`
- `PONG`

## Quick test plan

1. **Boot cue**
   - Power-cycle/reset the board.
   - Verify one startup vibration pulse is felt.

2. **Pairing LED**
   - Keep board unconnected.
   - Verify onboard LED double-blink pattern repeats.

3. **Connection state**
   - Connect from app/central.
   - Verify pairing LED pattern stops (LED steady off while connected).

4. **Protocol compatibility**
   - Send `PING` → expect `PONG`.
   - Send `PATTERN:PULSE` and `VIB:PULSE` (legacy alias) → both should update pattern.

5. **Mode behavior**
   - `MODE:INTERNAL`, `BPM:120`, `START` → periodic pulses.
   - `MODE:MIDI_CLOCK`, `START` → same periodic behavior (scaffold path).
   - `MODE:MIDI_BEAT` then repeated `BEAT` commands → one pulse per beat event.

## Notes
- Tunable UX constants (LED timing + startup waveform) are defined at the top of `RezoHaptic.ino`.
- Current protocol remains text-based for easy mobile app debugging.
