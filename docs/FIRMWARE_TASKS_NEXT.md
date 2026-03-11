# Firmware Next Tasks (nRF clock-master + MIDI beat-trigger)

1. Add `sync_mode_t` enum:
   - INTERNAL
   - MIDI_CLOCK_FOLLOW
   - MIDI_BEAT_TRIGGER

2. Internal scheduler remains source of truth for haptic tick timing in INTERNAL mode.

3. Implement MIDI path:
   - Handle Start/Stop/Continue/SPP
   - In MIDI_BEAT_TRIGGER mode: fire haptic pulse on incoming beat event
   - Add stale-trigger timeout guard

4. BLE command interface:
   - Accept SET_SYNC_MODE, SET_TEMPO, TRANSPORT_START/STOP, SET_PATTERN

5. Status notify payload:
   - mode, transport, bpm, beat, bar, battery

6. Test harness:
   - unit-test sync mode transitions
   - test timeout fallback behavior
   - test mode switch during active transport
