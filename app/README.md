# Rezo Haptic App (v0.1 scaffold)

Cross-platform app scaffold using Expo + React Native (iOS/Android/Web).

## Design system
- Minimal UI
- Font pairing: **Space Grotesk** (headings) + **Inter** (body/UI)
- Dark neutral palette optimized for stage/low-light use

## Run
```bash
cd app
npm install
npm run start
```

## Current features
- BPM entry
- Start/Stop transport toggle (UI state)
- Manual tap tempo estimator
- Mic tap mode toggle placeholder (for nRF52840 Sense feature pipeline)

## Next integration steps
1. BLE device discovery + connect
2. GATT service for tempo/transport
3. MIDI Clock + Start/Stop bridge
4. Mic-onset detector + confidence filter for tap tempo
