# Firmware Next Tasks (dual-LRA scheduler + BLE/app/plugin parity)

## Done
- ✅ Canonical protocol surface shared across firmware, app, and plugin:
  `MODE:INTERNAL|MIDI_CLOCK|MIDI_BEAT`, `SIDE:UNISON|ALTERNATE`, `POLY:left:right`
- ✅ Mobile `COMMANDS` helper covers all protocol verbs (SIDE, POLY added)
- ✅ Plugin presets (7 choices) now match mobile display names; mapping in `GATTConstants.h`
- ✅ DRV2605L LRA auto-calibration on boot; RATED_VOLTAGE/OD_CLAMP set for VLV101040A
- ✅ 16 waveform patterns revised to short, defined LRA effects; cutoff times tuned
- ✅ Status notify payload: mode, transport, bpm, beat, bar, battery, side, poly, pattern

## Remaining
1. Internal scheduler remains source of truth for haptic tick timing in INTERNAL mode.

2. Implement MIDI path:
   - Handle Start/Stop/Continue/SPP
   - In MIDI_BEAT mode: fire haptic pulse on incoming beat event
   - Add stale-trigger timeout guard

3. Finish app UI for desktop-only features (commands are wired):
   - side routing toggle
   - left/right pulse count controls
   - alternate-side beat visualization

4. Test harness:
   - unit-test sync mode transitions
   - test timeout fallback behavior
   - test mode switch during active transport

5. Validate LRA calibration on hardware:
   - Read `A_CAL_COMP` (0x18) and `A_CAL_BEMF` (0x19) after boot
   - Confirm calibration status bit in `GO` register clears cleanly
