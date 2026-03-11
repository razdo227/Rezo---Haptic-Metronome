# MIDI Sync State Machine (v0.1)

## Modes
- `INTERNAL`: nRF clock master (default)
- `MIDI_CLOCK_FOLLOW`: nRF phase-locks to external MIDI clock (24 PPQN)
- `MIDI_BEAT_TRIGGER`: nRF fires haptic events directly on incoming beat triggers

## Behavior
- In INTERNAL mode, app only sends state updates (tempo/transport/pattern), never per-beat timing.
- In MIDI_BEAT_TRIGGER mode, each external beat event causes immediate haptic trigger.
- If beat triggers disappear for `beatTriggerTimeoutMs`, transport should stop or fallback (configurable).

## Commands (app -> nRF)
- `SET_SYNC_MODE(mode)`
- `SET_TEMPO(bpm)`
- `TRANSPORT_START`
- `TRANSPORT_STOP`
- `SET_PATTERN(payload)`

## Events (nRF -> app)
- `STATUS { bpm, transport, mode, beat, bar }`
- `SYNC_LOCK { mode, confidence }`
- `SYNC_TIMEOUT { mode }`
