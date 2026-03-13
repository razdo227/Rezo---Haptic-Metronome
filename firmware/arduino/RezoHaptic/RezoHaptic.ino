#include <Arduino.h>
#include <ArduinoBLE.h>
#include <Wire.h>
#include <Adafruit_DRV2605.h>

// =========================
// Rezo Haptic v0.3 (Arduino)
// Target: Seeed XIAO nRF52840
// Driver: DRV2605 (I2C)
// =========================

// ---------- UX tuning constants ----------
// LED behavior while idle and advertising (pairing-ready).
// Pattern: two short flashes, then a pause.
constexpr uint32_t PAIR_LED_PHASE_MS = 1200;  // total cycle length
constexpr uint32_t PAIR_LED_ON1_START_MS = 0;
constexpr uint32_t PAIR_LED_ON1_END_MS = 90;
constexpr uint32_t PAIR_LED_ON2_START_MS = 200;
constexpr uint32_t PAIR_LED_ON2_END_MS = 290;

// XIAO nRF52840 onboard LED is active-low.
constexpr uint8_t LED_ON_LEVEL = LOW;
constexpr uint8_t LED_OFF_LEVEL = HIGH;

// Startup haptic cue (single pulse at boot).
// DRV2605 effect IDs are from the built-in waveform library.
constexpr uint8_t STARTUP_WAVEFORM_ID = 47;  // strong pulse

enum SyncMode : uint8_t {
  SYNC_INTERNAL = 0,
  SYNC_MIDI_CLOCK_FOLLOW = 1,
  SYNC_MIDI_BEAT_TRIGGER = 2,
};

enum VibrationPattern : uint8_t {
  PATTERN_CLICK = 0,
  PATTERN_PULSE,
  PATTERN_ACCENT,
  PATTERN_DOUBLE,
  PATTERN_TRIPLET,
  PATTERN_RAMP_UP,
  PATTERN_RAMP_DOWN,
  PATTERN_BUZZ_HOLD,
};

struct RuntimeState {
  bool running = false;
  uint16_t bpm = 120;
  SyncMode syncMode = SYNC_INTERNAL;
  VibrationPattern pattern = PATTERN_PULSE;

  uint32_t nextPulseMs = 0;
  uint32_t lastBeatMs = 0;
  uint16_t beatTriggerTimeoutMs = 2000;
};

RuntimeState state;
Adafruit_DRV2605 drv;

BLEService rezoService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEStringCharacteristic cmdChar("19B10001-E8F2-537E-4F6C-D104768A1214", BLEWrite | BLEWriteWithoutResponse, 64);
BLEStringCharacteristic statusChar("19B10002-E8F2-537E-4F6C-D104768A1214", BLENotify | BLERead, 96);

const char* patternName(VibrationPattern p) {
  switch (p) {
    case PATTERN_CLICK: return "CLICK";
    case PATTERN_PULSE: return "PULSE";
    case PATTERN_ACCENT: return "ACCENT";
    case PATTERN_DOUBLE: return "DOUBLE";
    case PATTERN_TRIPLET: return "TRIPLET";
    case PATTERN_RAMP_UP: return "RAMP_UP";
    case PATTERN_RAMP_DOWN: return "RAMP_DOWN";
    case PATTERN_BUZZ_HOLD: return "BUZZ_HOLD";
    default: return "PULSE";
  }
}

void setLed(bool on) {
  digitalWrite(LED_BUILTIN, on ? LED_ON_LEVEL : LED_OFF_LEVEL);
}

void updatePairingLed(uint32_t nowMs) {
  // Only used when no BLE central is connected.
  const uint32_t phase = nowMs % PAIR_LED_PHASE_MS;
  const bool on = (phase >= PAIR_LED_ON1_START_MS && phase < PAIR_LED_ON1_END_MS) ||
                  (phase >= PAIR_LED_ON2_START_MS && phase < PAIR_LED_ON2_END_MS);
  setLed(on);
}

void loadWaveform(VibrationPattern p) {
  // DRV2605 waveform slots (0..7), 0 terminator
  switch (p) {
    case PATTERN_CLICK:
      drv.setWaveform(0, 1);
      drv.setWaveform(1, 0);
      break;
    case PATTERN_PULSE:
      drv.setWaveform(0, 47);
      drv.setWaveform(1, 0);
      break;
    case PATTERN_ACCENT:
      drv.setWaveform(0, 14);
      drv.setWaveform(1, 0);
      break;
    case PATTERN_DOUBLE:
      drv.setWaveform(0, 1);
      drv.setWaveform(1, 1);
      drv.setWaveform(2, 0);
      break;
    case PATTERN_TRIPLET:
      drv.setWaveform(0, 1);
      drv.setWaveform(1, 1);
      drv.setWaveform(2, 1);
      drv.setWaveform(3, 0);
      break;
    case PATTERN_RAMP_UP:
      drv.setWaveform(0, 74);
      drv.setWaveform(1, 0);
      break;
    case PATTERN_RAMP_DOWN:
      drv.setWaveform(0, 75);
      drv.setWaveform(1, 0);
      break;
    case PATTERN_BUZZ_HOLD:
      drv.setWaveform(0, 52);
      drv.setWaveform(1, 0);
      break;
  }
}

void fireHapticPulse() {
  loadWaveform(state.pattern);
  drv.go();
}

void playStartupHapticCue() {
  drv.setWaveform(0, STARTUP_WAVEFORM_ID);
  drv.setWaveform(1, 0);
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
  snprintf(buf, sizeof(buf), "run=%d;bpm=%u;mode=%s;pattern=%s", state.running ? 1 : 0, state.bpm, mode, patternName(state.pattern));
  statusChar.writeValue(buf);
}

void applyPatternToken(const String& token) {
  if (token == "CLICK") state.pattern = PATTERN_CLICK;
  else if (token == "PULSE") state.pattern = PATTERN_PULSE;
  else if (token == "ACCENT") state.pattern = PATTERN_ACCENT;
  else if (token == "DOUBLE") state.pattern = PATTERN_DOUBLE;
  else if (token == "TRIPLET") state.pattern = PATTERN_TRIPLET;
  else if (token == "RAMP_UP") state.pattern = PATTERN_RAMP_UP;
  else if (token == "RAMP_DOWN") state.pattern = PATTERN_RAMP_DOWN;
  else if (token == "BUZZ_HOLD" || token == "BUZZ") state.pattern = PATTERN_BUZZ_HOLD;
}

void applyCommand(const String& raw) {
  String cmd = raw;
  cmd.trim();
  cmd.toUpperCase();

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

  if (cmd.startsWith("PATTERN:")) {
    applyPatternToken(cmd.substring(8));
    publishStatus();
    return;
  }

  if (cmd.startsWith("VIB:")) {
    // Backward compatible alias
    applyPatternToken(cmd.substring(4));
    publishStatus();
    return;
  }

  if (cmd == "BEAT") {
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
    while (1) delay(250);
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
    while (1) delay(250);
  }
  drv.selectLibrary(1);
  drv.setMode(DRV2605_MODE_INTTRIG);
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  setLed(false);

  setupDrv2605();
  playStartupHapticCue();

  setupBle();

  state.running = false;
  state.bpm = 120;
  state.syncMode = SYNC_INTERNAL;
  state.pattern = PATTERN_PULSE;
  state.nextPulseMs = millis() + beatIntervalMs(state.bpm);
  publishStatus();
}

void loop() {
  BLE.poll();

  BLEDevice central = BLE.central();
  const bool connected = central && central.connected();

  if (!connected) {
    // Pairing-ready UX cue while advertising and waiting for app connection.
    updatePairingLed(millis());
    delay(1);
    return;
  }

  // Connected: keep LED steady off to indicate active link.
  setLed(false);

  if (cmdChar.written()) {
    applyCommand(cmdChar.value());
  }

  const uint32_t now = millis();

  if (state.running && (state.syncMode == SYNC_INTERNAL || state.syncMode == SYNC_MIDI_CLOCK_FOLLOW)) {
    // INTERNAL mode uses local tempo scheduler.
    // MIDI_CLOCK mode currently reuses the same scheduler as a compatibility scaffold;
    // future BLE-MIDI clock ticks can update scheduling without changing command protocol.
    if ((int32_t)(now - state.nextPulseMs) >= 0) {
      fireHapticPulse();
      state.nextPulseMs += beatIntervalMs(state.bpm);
    }
  }

  if (state.running && state.syncMode == SYNC_MIDI_BEAT_TRIGGER) {
    if (state.lastBeatMs > 0 && (now - state.lastBeatMs) > state.beatTriggerTimeoutMs) {
      state.running = false;
      publishStatus();
    }
  }

  delay(1);
}
