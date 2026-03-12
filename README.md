# Rezo — Haptic Metronome

![Status](https://img.shields.io/badge/status-active-2f6feb)
![Platform](https://img.shields.io/badge/platform-Expo%20%7C%20nRF52840-3b3f46)
![License](https://img.shields.io/badge/license-MIT-5b6573)

A hardware + firmware + mobile app capstone project for a wearable haptic metronome.

## Architecture (at a glance)

```text
Mobile App (Expo / React Native)
  └─ Controls: BPM, transport, sync mode, tap tempo, vibration type
  └─ Sync Modes: INTERNAL | MIDI_CLOCK_FOLLOW | MIDI_BEAT_TRIGGER
            │
            ▼
BLE GATT Transport (next integration step)
            │
            ▼
nRF52840 (clock-master on device)
  └─ Real-time haptic scheduler
  └─ MIDI sync handling
  └─ LRA drive path (DRV2605L x2)
            │
            ▼
Custom PCB + wearable enclosure
```

## Repo layout

- `app/` — cross-platform app (Expo/React Native)
  - `app/app/index.tsx` — main UI
  - `app/src/lib/tempo.ts` — tap/BPM logic
  - `app/src/lib/midiClock.ts` — MIDI clock BPM estimation
  - `app/src/lib/micTap.ts` — mic onset/tap detection logic
  - `app/src/lib/syncMode.ts` — sync mode runtime/state machine
  - `app/src/services/transportService.ts` — transport abstraction (mock now)
  - `app/src/ui/theme.ts` — design tokens
  - `app/tests/` — unit tests (Vitest)
- `Kicad Schematics/` — schematic, PCB, and DRC/ERC outputs
- `fab/` — manufacturing files (Gerbers, drill, ZIP)
- `docs/` — project specs, workflows, and engineering notes

## Current status

- App UI: professional minimal layout + compact top section
- App logic: tempo, sync modes, MIDI clock estimator, mic tap pipeline scaffolding
- Tests: passing (`vitest`)
- PCB: v0.1 DRC cleaned to non-critical warnings + Gerbers exported
- Routing: OpenClaw project routing and task system set up

## Build matrix

| Workstream | Status | Notes |
|---|---|---|
| Mobile App | In Progress | Core UI and sync controls implemented |
| Firmware | In Progress | Sync mode protocol defined; implementation next |
| PCB (v0.1) | In Progress | DRC stabilized; fabrication files generated |
| Validation | In Progress | Unit tests passing; HIL tests pending |
| Research Study | Planned | Protocol and analysis pipeline outlined |

## Run app locally

```bash
cd app
npm install
npm run start
```

## Validate app logic

```bash
cd app
npm test
npx tsc --noEmit
```

## Next priorities

1. Replace mock transport with real BLE GATT integration.
2. Implement nRF firmware sync-mode state machine to match app protocol.
3. Hardware-in-loop tests for timing jitter and haptic response.
4. Study pipeline integration (logging + export for analysis).
