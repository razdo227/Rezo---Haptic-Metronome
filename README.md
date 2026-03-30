# Rezo — Haptic Metronome

![Status](https://img.shields.io/badge/status-active-2f6feb)
![Platform](https://img.shields.io/badge/platform-Expo%20%7C%20nRF52840-3b3f46)
![License](https://img.shields.io/badge/license-MIT-5b6573)

A hardware + firmware + mobile app capstone project for a wearable haptic metronome.

## Architecture (at a glance)

```text
Mobile App (Expo / React Native)
  └─ Controls: BPM, transport, sync mode, tap tempo, vibration type
  └─ Sync Modes: INTERNAL | MIDI_CLOCK | MIDI_BEAT
            │
            ├── BLE GATT
            │
Desktop Plugin (JUCE VST3/AU) + Rezo Helper
  └─ DAW transport -> helper IPC -> BLE GATT
  └─ Defaults device mode to MIDI_CLOCK on desktop connect
            │
            ▼
nRF52840 wearable firmware
  └─ Real-time haptic scheduler
  └─ INTERNAL / MIDI_CLOCK / MIDI_BEAT runtime modes
  └─ Dual-LRA drive path (DRV2605L x2)
  └─ Side routing + polyrhythm scheduling
            │
            ▼
Custom PCB + wearable enclosure
```

## Repo layout

- `app/` — cross-platform app (Expo/React Native)
  - `app/src/screens/MainScreen.tsx` — main device-control UI
  - `app/src/context/DeviceContext.tsx` — BLE state + status parsing
  - `app/src/services/BLEService.ts` — BLE transport
  - `app/src/lib/tempo.ts` — tap/BPM logic
  - `app/tests/` — unit tests (Vitest)
- `Kicad Schematics/` — schematic, PCB, and DRC/ERC outputs
- `firmware/` — nRF firmware scaffold + Arduino-ready sketch
- `rezo-plugin/` — JUCE desktop plugin, helper app, and tests
  - `rezo-plugin/Source/` — plugin, helper, BLE bridge, and UI code
  - `rezo-plugin/Tests/` — Catch2 protocol and transport tests
  - `rezo-plugin/JUCE/` — JUCE submodule
- `fab/` — manufacturing files (Gerbers, drill, ZIP)
- `docs/` — project specs, workflows, and engineering notes

## Current status

- App: BLE control surface for INTERNAL / MIDI_CLOCK / MIDI_BEAT modes
- Firmware: dual-LRA scheduler with side-routing and polyrhythm support
- Desktop: JUCE VST3/AU plugin with helper-based BLE bridge for DAWs
- Tests: app unit tests and plugin Catch2 suite
- PCB: v0.1 DRC cleaned to non-critical warnings + Gerbers exported

## Build matrix

| Workstream | Status | Notes |
|---|---|---|
| Mobile App | In Progress | BLE control path is in place; desktop parity still ongoing |
| Firmware | In Progress | Desktop/app protocol implemented; hardware tuning continues |
| Desktop Plugin | In Progress | Helper-based BLE path working in DAWs |
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

## Build desktop plugin

```bash
cd rezo-plugin
cmake -S . -B build/debug -DCMAKE_BUILD_TYPE=Debug
cmake --build build/debug --config Debug
ctest --test-dir build/debug -C Debug --output-on-failure
```

## Next priorities

1. Add app-side controls for side routing and polyrhythms.
2. Tune waveform tables for the dual-LRA hardware.
3. Hardware-in-loop tests for timing jitter and haptic response.
4. Publish the desktop/helper workflow and host compatibility notes.
