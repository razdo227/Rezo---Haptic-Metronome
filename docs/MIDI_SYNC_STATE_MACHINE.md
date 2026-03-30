# MIDI Sync State Machine (v0.1)

## Modes
- `INTERNAL`: nRF clock master (default)
- `MIDI_CLOCK`: device transport follows host/app clock state and bar tempo
- `MIDI_BEAT`: device fires haptic events directly on incoming beat triggers

## Behavior
- In INTERNAL mode, app only sends state updates (tempo/transport/pattern), never per-beat timing.
- In MIDI_CLOCK mode, the device scheduler remains active but is re-armed from host/app transport.
- In MIDI_BEAT mode, each external beat event causes immediate haptic trigger.
- If beat triggers disappear for `beatTriggerTimeoutMs`, transport should stop or fallback (configurable).

## Commands (app -> nRF)
- `MODE:<INTERNAL|MIDI_CLOCK|MIDI_BEAT>`
- `BPM:<20..300>`
- `START`
- `STOP`
- `BEAT`
- `PATTERN:<name|index>`
- `SIDE:<UNISON|ALTERNATE>`
- `POLY:<left>:<right>`

## Events (nRF -> app)
- `STATUS { bpm, transport, mode, beat, bar, side, poly, pattern }`
- `SYNC_LOCK { mode, confidence }`
- `SYNC_TIMEOUT { mode }`
