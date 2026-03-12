#include <Arduino.h>
#include <ArduinoBLE.h>
#include <Wire.h>
#include <Adafruit_DRV2605.h>

// =========================
// Rezo Haptic v0.1 (Arduino)
// Target: Seeed XIAO nRF52840
// Driver: DRV2605 (I2C)
// =========================

enum SyncMode : uint8_t {
  SYNC_INTERNAL = 0,
  SYNC_MIDI_CLOCK_FOLLOW = 1,
  SYNC_MIDI_BEAT_TRIGGER = 2,
};

enum VibrationType : uint8_t {
  VIB_SOFT = 0,
  VIB_PULSE = 1,
  VIB_SHARP = 2,
};

struct RuntimeState {
  bool running = false;
  uint16_t bpm = 120;
  SyncMode syncMode = SYNC_INTERNAL;
  VibrationType vibType = VIB_PULSE;

  // Internal scheduler
  uint32_t nextPulseMs = 0;

  // MIDI beat trigger mode
  uint32_t lastBeatMs = 0;
  uint16_t beatTriggerTimeoutMs = 2000;
};

RuntimeState state;
Adafruit_DRV2605 drv;

// BLE UUIDs (replace with final production UUIDs if needed)
BLEService rezoService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEStringCharacteristic cmdChar("19B10001-E8F2-537E-4F6C-D104768A1214", BLEWrite | BLEWriteWithoutResponse, 64);
BLEStringCharacteristic statusChar("19B10002-E8F2-537E-4F6C-D104768A1214", BLENotify | BLERead, 96);

uint8_t effectFor(VibrationType t) {
  // ERM/LRA feel can vary with hardware. Tune these IDs during test.
  switch (t) {
    case VIB_SOFT: return 47;   // soft bump
    case VIB_PULSE: return 1;   // strong click
    case VIB_SHARP: return 12;  // sharp tick
    default: return 1;
  }
}

void fireHapticPulse() {
  drv.setWaveform(0, effectFor(state.vibType));
  drv.setWaveform(1, 0); // end
  drv.go();
}

uint32_t beatIntervalMs(uint16_t bpm) {
  if (bpm < 20) bpm = 20;
  if (bpm > 300) bpm = 300;
  return 60000UL / bpm;
}

void scheduleNextInternalPulse(uint32_t nowMs) {
  state.nextPulseMs = nowMs + beatIntervalMs(state.bpm);
}

void publishStatus() {
  char buf[96];
  const char* mode = (state.syncMode == SYNC_INTERNAL) ? "INTERNAL" : (state.syncMode == SYNC_MIDI_CLOCK_FOLLOW) ? "MIDI_CLOCK" : "MIDI_BEAT";
  const char* vib = (state.vibType == VIB_SOFT) ? "SOFT" : (state.vibType == VIB_PULSE) ? "PULSE" : "SHARP";

  snprintf(buf, sizeof(buf), "run=%d;bpm=%u;mode=%s;vib=%s", state.running ? 1 : 0, state.bpm, mode, vib);
  statusChar.writeValue(buf);
}

void applyCommand(const String& raw) {
  String cmd = raw;
  cmd.trim();
  cmd.toUpperCase();

  // Commands (text protocol for easy debugging):
  // START
  // STOP
  // BPM:120
  // MODE:INTERNAL | MODE:MIDI_CLOCK | MODE:MIDI_BEAT
  // VIB:SOFT | VIB:PULSE | VIB:SHARP
  // BEAT (for MIDI beat-trigger test)
  // PING

  if (cmd == "START") {
    state.running = true;
    scheduleNextInternalPulse(millis());
    publishStatus();
    return;
  }

  if (cmd == "STOP") {
    state.running = false;
    publishStatus();
    return;
  }

  if (cmd.startsWith("BPM:")) {
    int v = cmd.substring(4).toInt();
    if (v < 20) v = 20;
    if (v > 300) v = 300;
    state.bpm = (uint16_t)v;
    scheduleNextInternalPulse(millis());
    publishStatus();
    return;
  }

  if (cmd.startsWith("MODE:")) {
    String m = cmd.substring(5);
    if (m == "INTERNAL") state.syncMode = SYNC_INTERNAL;
    else if (m == "MIDI_CLOCK") state.syncMode = SYNC_MIDI_CLOCK_FOLLOW;
    else if (m == "MIDI_BEAT") state.syncMode = SYNC_MIDI_BEAT_TRIGGER;
    publishStatus();
    return;
  }

  if (cmd.startsWith("VIB:")) {
    String v = cmd.substring(4);
    if (v == "SOFT") state.vibType = VIB_SOFT;
    else if (v == "PULSE") state.vibType = VIB_PULSE;
    else if (v == "SHARP") state.vibType = VIB_SHARP;
    publishStatus();
    return;
  }

  if (cmd == "BEAT") {
    // External beat event hook for MIDI_BEAT_TRIGGER mode
    if (state.syncMode == SYNC_MIDI_BEAT_TRIGGER) {
      state.lastBeatMs = millis();
      state.running = true;
      fireHapticPulse();
      publishStatus();
    }
    return;
  }

  if (cmd == "PING") {
    statusChar.writeValue("PONG");
    return;
  }
}

void setupBle() {
  if (!BLE.begin()) {
    while (1) {
      delay(250);
    }
  }

  BLE.setLocalName("RezoHaptic");
  BLE.setDeviceName("RezoHaptic");
  BLE.setAdvertisedService(rezoService);

  rezoService.addCharacteristic(cmdChar);
  rezoService.addCharacteristic(statusChar);
  BLE.addService(rezoService);

  statusChar.writeValue("boot");
  BLE.advertise();
}

void setupDrv2605() {
  Wire.begin();
  if (!drv.begin()) {
    while (1) {
      delay(250);
    }
  }

  drv.selectLibrary(1);
  // Use internal trigger mode by default
  drv.setMode(DRV2605_MODE_INTTRIG);
}

void setup() {
  setupDrv2605();
  setupBle();

  state.running = false;
  state.bpm = 120;
  state.syncMode = SYNC_INTERNAL;
  state.vibType = VIB_PULSE;
  state.nextPulseMs = millis() + beatIntervalMs(state.bpm);
  publishStatus();
}

void loop() {
  BLEDevice central = BLE.central();
  if (central) {
    while (central.connected()) {
      BLE.poll();

      if (cmdChar.written()) {
        String cmd = cmdChar.value();
        applyCommand(cmd);
      }

      const uint32_t now = millis();

      // Internal clock mode: nRF is master
      if (state.running && (state.syncMode == SYNC_INTERNAL || state.syncMode == SYNC_MIDI_CLOCK_FOLLOW)) {
        if ((int32_t)(now - state.nextPulseMs) >= 0) {
          fireHapticPulse();
          state.nextPulseMs += beatIntervalMs(state.bpm);
        }
      }

      // MIDI beat trigger mode timeout guard
      if (state.running && state.syncMode == SYNC_MIDI_BEAT_TRIGGER) {
        if (state.lastBeatMs > 0 && (now - state.lastBeatMs) > state.beatTriggerTimeoutMs) {
          state.running = false;
          publishStatus();
        }
      }

      delay(1);
    }
  }

  BLE.poll();
  delay(1);
}
