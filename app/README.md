# Rezo Haptic App (v0.1 scaffold)

Cross-platform app scaffold using Expo + React Native (iOS/Android/Web).

## Design system
- Minimal dark UI with elevated panels and low-glare contrast
- Shared tokens in `src/ui/theme.ts` for color, spacing, radius, and type scale
- Consistent pill chips, primary/secondary actions, and grouped telemetry blocks

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
