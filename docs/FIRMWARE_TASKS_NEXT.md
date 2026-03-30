# Firmware Next Tasks (dual-LRA scheduler + BLE/app/plugin parity)

1. Keep one canonical protocol surface across app, firmware, and desktop plugin:
   - `MODE:INTERNAL`
   - `MODE:MIDI_CLOCK`
   - `MODE:MIDI_BEAT`
   - `SIDE:UNISON|ALTERNATE`
   - `POLY:left:right`

2. Internal scheduler remains source of truth for haptic tick timing in INTERNAL mode.

3. Implement MIDI path:
   - Handle Start/Stop/Continue/SPP
   - In MIDI_BEAT mode: fire haptic pulse on incoming beat event
   - Add stale-trigger timeout guard

4. Finish app parity for desktop-only features:
   - side routing
   - left/right pulse counts
   - alternate-side visualization

5. Status notify payload:
   - mode, transport, bpm, beat, bar, battery, side, poly, pattern

6. Test harness:
   - unit-test sync mode transitions
   - test timeout fallback behavior
   - test mode switch during active transport
