// =============================================================
// Rezo Haptic Metronome — v1.2
// Target:  Seeed XIAO nRF52840
// Drivers: 2× DRV2605L on separate I2C buses
//            Left  motor → Wire  (TWI0, hardware): SDA=D4, SCL=D5
//            Right motor → WireR (TWI1, custom pins): SDA=D2, SCL=D3
//                          D2=P0.28, D3=P0.29 — any GPIO is valid
//                          on nRF52840 via PSEL register remapping.
//          Both drivers sit at the default address 0x5A —
//          no ADDR pin pull-up needed.
// Battery: 3.7V LiPo (401030) via JST connector
// BLE:     nRF Connect compatible GATT service
// =============================================================

#include <Arduino.h>
#include <ArduinoBLE.h>
#include <Wire.h>
#include <Adafruit_DRV2605.h>

// -------------------------------------------------------------
// Pin definitions (Seeed XIAO nRF52840 BSP)
// -------------------------------------------------------------
#ifndef PIN_VBAT
#define PIN_VBAT    (32)   // P0.31, AIN7 — defined in Seeed BSP variant.h
#endif
#ifndef VBAT_ENABLE
#define VBAT_ENABLE (14)   // P0.14 — active LOW enables the voltage divider
#endif

// Charging status pin (active-low). P0.17 on XIAO nRF52840 Sense — verify with your BSP.
constexpr uint8_t CHG_PIN = 23;

// -------------------------------------------------------------
// Timing / UX constants
// -------------------------------------------------------------
constexpr uint32_t BATTERY_SAMPLE_INTERVAL_MS = 30000;  // 30 s between battery reads

constexpr uint16_t BPM_MIN = 20;
constexpr uint16_t BPM_MAX = 300;

// LED (active-low on XIAO)
constexpr uint8_t LED_ON  = LOW;
constexpr uint8_t LED_OFF = HIGH;

// Pairing-mode blink: two short flashes per 1.2 s cycle
constexpr uint32_t PAIR_CYCLE_MS  = 1200;
constexpr uint32_t PAIR_ON1_START =    0;
constexpr uint32_t PAIR_ON1_END   =   90;
constexpr uint32_t PAIR_ON2_START =  200;
constexpr uint32_t PAIR_ON2_END   =  290;

// -------------------------------------------------------------
// Second I2C bus for right motor
// WireR is bound to D2 (SDA=P0.28) and D3 (SCL=P0.29).
// Declared as a new MbedI2C object — Wire1 is reserved by the BSP.
// On ArduinoCore-mbed, TwoWire is a typedef for arduino::MbedI2C.
// -------------------------------------------------------------
arduino::MbedI2C WireR(D2, D3);

// -------------------------------------------------------------
// Vibration pattern library
// DRV2605L ROM waveform IDs — for Vybronics VLV101040A LRAs these should be
// played from the DRV2605 LRA library (library 6) with the device in LRA mode.
// Slots: up to 8 waveforms, 0-terminated.
// WAVEFORMS_ACCENT[i] is the downbeat (beat 1) variant of pattern i.
// -------------------------------------------------------------
struct WaveformSequence {
  uint8_t slots[8];
};

enum class SyncMode : uint8_t {
  Internal,
  MidiClock,
  MidiBeat,
};

enum class SideMode : uint8_t {
  Unison,
  Alternate,
};

struct ScheduledEvent {
  uint32_t offsetMs = 0;
  bool fireLeft = false;
  bool fireRight = false;
  bool isDownbeat = false;
};

struct MotorGate {
  bool active = false;
  uint32_t stopAtMs = 0;
};

static const WaveformSequence WAVEFORMS_NORMAL[] = {
  // 0  CLICK          — short crisp tap (Sharp Click 100%)
  {{ 1, 0 }},
  // 1  PULSE          — medium tap (Strong Click 60%)
  {{ 2, 0 }},
  // 2  SOFT_BUMP      — gentle nudge (Soft Bump 100%)
  {{ 10, 0 }},
  // 3  SHARP          — fast strong tick (Sharp Click 100%)
  {{ 1, 0 }},
  // 4  DOUBLE         — two rapid taps
  {{ 1, 1, 0 }},
  // 5  TRIPLET        — three rapid taps
  {{ 1, 1, 1, 0 }},
  // 6  RAMP_UP        — swells in (Transition Ramp Up Short Smooth 1)
  {{ 71, 0 }},
  // 7  RAMP_DOWN      — fades out (Transition Ramp Down Short Smooth 1)
  {{ 73, 0 }},
  // 8  BUZZ_HOLD      — sustained buzz (1000ms buzz)
  {{ 52, 0 }},
  // 9  THUD           — deep low-frequency hit (Heavy Click 100%)
  {{ 5, 0 }},
  // 10 HEARTBEAT      — ba-bum (two medium hits)
  {{ 2, 2, 0 }},
  // 11 LONG_BUZZ      — extended hold buzz
  {{ 84, 0 }},
  // 12 SOFT_CLICK     — very light tap (Soft Click 100%)
  {{ 11, 0 }},
  // 13 POPS           — two sharp pops
  {{ 1, 1, 0 }},
  // 14 TRANSITION_HUM — ramp + hold (Transition Ramp + buzz)
  {{ 71, 52, 0 }},
  // 15 STRONG_CLICK   — firm single hit (Heavy Click 100%)
  {{ 5, 0 }},
};
constexpr uint8_t PATTERN_COUNT = sizeof(WAVEFORMS_NORMAL) / sizeof(WAVEFORMS_NORMAL[0]);

// Accent = downbeat. Use the hardest single hit available (waveform 5 = Heavy Click 100%)
// to give a clear tactile distinction from subdivisions.
static const WaveformSequence WAVEFORMS_ACCENT[] = {
  // 0  CLICK accent
  {{ 5, 0 }},
  // 1  PULSE accent
  {{ 5, 0 }},
  // 2  SOFT_BUMP accent
  {{ 5, 0 }},
  // 3  SHARP accent
  {{ 5, 0 }},
  // 4  DOUBLE accent
  {{ 5, 0 }},
  // 5  TRIPLET accent
  {{ 5, 0 }},
  // 6  RAMP_UP accent
  {{ 5, 0 }},
  // 7  RAMP_DOWN accent
  {{ 5, 0 }},
  // 8  BUZZ_HOLD accent
  {{ 5, 0 }},
  // 9  THUD accent
  {{ 5, 0 }},
  // 10 HEARTBEAT accent
  {{ 5, 0 }},
  // 11 LONG_BUZZ accent
  {{ 5, 0 }},
  // 12 SOFT_CLICK accent
  {{ 5, 0 }},
  // 13 POPS accent
  {{ 5, 0 }},
  // 14 TRANSITION_HUM accent
  {{ 5, 0 }},
  // 15 STRONG_CLICK accent
  {{ 5, 0 }},
};

static const char* PATTERN_NAMES[] = {
  "CLICK", "PULSE", "SOFT_BUMP", "SHARP", "DOUBLE", "TRIPLET",
  "RAMP_UP", "RAMP_DOWN", "BUZZ_HOLD", "THUD", "HEARTBEAT",
  "LONG_BUZZ", "SOFT_CLICK", "POPS", "TRANSITION_HUM", "STRONG_CLICK"
};

static const uint8_t PATTERN_CUTOFF_MS[] = {
  20, // CLICK          (waveform 1:  ~16 ms)
  25, // PULSE          (waveform 2:  ~20 ms)
  28, // SOFT_BUMP      (waveform 10: ~24 ms)
  20, // SHARP          (waveform 1:  ~16 ms)
  36, // DOUBLE         (two waveform 1s: ~32 ms)
  50, // TRIPLET        (three waveform 1s: ~48 ms)
  50, // RAMP_UP        (waveform 71: ~46 ms)
  50, // RAMP_DOWN      (waveform 73: ~46 ms)
  40, // BUZZ_HOLD      (waveform 52: ~36 ms)
  22, // THUD           (waveform 5:  ~18 ms)
  44, // HEARTBEAT      (two waveform 2s: ~40 ms)
  50, // LONG_BUZZ      (waveform 84: ~46 ms)
  18, // SOFT_CLICK     (waveform 11: ~14 ms)
  36, // POPS           (two waveform 1s: ~32 ms)
  90, // TRANSITION_HUM (waveform 71 + 52: ~86 ms)
  22, // STRONG_CLICK   (waveform 5:  ~18 ms)
};

// -------------------------------------------------------------
// Runtime state
// -------------------------------------------------------------
struct RezoState {
  bool     running     = false;
  uint16_t bpm         = 120;
  uint8_t  timeSigNum  = 4;   // beats per bar (numerator)
  uint8_t  timeSigDen  = 4;   // beat unit (denominator) — informational
  uint8_t  pattern     = 1;   // index into WAVEFORMS_NORMAL / WAVEFORMS_ACCENT
  SyncMode mode        = SyncMode::Internal;
  SideMode sideMode    = SideMode::Unison;
  uint8_t  leftPulses  = 0;   // 0 = follow current bar beat count
  uint8_t  rightPulses = 0;   // 0 = follow current bar beat count
  uint8_t  beatCount   = 0;   // current beat within bar (0-indexed)
  uint32_t barStartMs  = 0;
  uint8_t  nextEventIx = 0;
  uint8_t  batteryPct  = 0;
  bool     charging    = false;
  uint8_t  eventCount  = 0;
  ScheduledEvent events[16];
};

RezoState g;

// Two independent driver objects, each bound to its own I2C bus.
Adafruit_DRV2605 drvL;  // left  — Wire  (D4/D5)
Adafruit_DRV2605 drvR;  // right — WireR (D2/D3)
MotorGate gateL;
MotorGate gateR;

// -------------------------------------------------------------
// BLE GATT service
// Service UUID:  19B10000-E8F2-537E-4F6C-D104768A1214
// Characteristics:
//   CMD    (write)        19B10001-...
//   STATUS (notify+read)  19B10002-...
// -------------------------------------------------------------
BLEService rezoService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEStringCharacteristic cmdChar("19B10001-E8F2-537E-4F6C-D104768A1214",
                                 BLEWrite | BLEWriteWithoutResponse, 64);
BLEStringCharacteristic statusChar("19B10002-E8F2-537E-4F6C-D104768A1214",
                                    BLENotify | BLERead, 128);

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
inline uint32_t beatIntervalMs(uint16_t bpm) {
  return 60000UL / bpm;
}

const char* modeName(SyncMode mode) {
  switch (mode) {
    case SyncMode::Internal:  return "INTERNAL";
    case SyncMode::MidiClock: return "MIDI_CLOCK";
    case SyncMode::MidiBeat:  return "MIDI_BEAT";
  }
  return "INTERNAL";
}

const char* sideModeName(SideMode mode) {
  switch (mode) {
    case SideMode::Unison:    return "UNISON";
    case SideMode::Alternate: return "ALTERNATE";
  }
  return "UNISON";
}

uint8_t effectivePulseCount(uint8_t configured) {
  return configured == 0 ? (g.timeSigNum == 0 ? 1 : g.timeSigNum) : configured;
}

uint32_t barDurationMs() {
  const uint32_t quarterMs = beatIntervalMs(g.bpm);
  const uint32_t scaled = quarterMs * static_cast<uint32_t>(g.timeSigNum) * 4UL;
  const uint8_t beatUnit = g.timeSigDen == 0 ? 1 : g.timeSigDen;
  const uint32_t result = scaled / beatUnit;
  return result == 0 ? 1 : result;
}

uint8_t beatIndexForOffset(uint32_t offsetMs) {
  const uint32_t barMs = barDurationMs();
  if (barMs == 0 || g.timeSigNum == 0) return 0;
  const uint8_t idx = static_cast<uint8_t>((static_cast<uint64_t>(offsetMs) * g.timeSigNum) / barMs);
  return idx >= g.timeSigNum ? static_cast<uint8_t>(g.timeSigNum - 1) : idx;
}

bool offsetsMatch(uint32_t a, uint32_t b) {
  const int32_t delta = static_cast<int32_t>(a) - static_cast<int32_t>(b);
  return abs(delta) <= 2;
}

void insertOrMergeEvent(uint32_t offsetMs, bool fireLeft, bool fireRight, bool isDownbeat) {
  for (uint8_t i = 0; i < g.eventCount; ++i) {
    if (offsetsMatch(g.events[i].offsetMs, offsetMs)) {
      g.events[i].fireLeft = g.events[i].fireLeft || fireLeft;
      g.events[i].fireRight = g.events[i].fireRight || fireRight;
      g.events[i].isDownbeat = g.events[i].isDownbeat || isDownbeat;
      return;
    }
  }

  if (g.eventCount >= 16) return;

  uint8_t insertAt = g.eventCount;
  while (insertAt > 0 && g.events[insertAt - 1].offsetMs > offsetMs) {
    g.events[insertAt] = g.events[insertAt - 1];
    --insertAt;
  }

  g.events[insertAt].offsetMs = offsetMs;
  g.events[insertAt].fireLeft = fireLeft;
  g.events[insertAt].fireRight = fireRight;
  g.events[insertAt].isDownbeat = isDownbeat;
  ++g.eventCount;
}

void rebuildBarSchedule() {
  g.eventCount = 0;
  g.nextEventIx = 0;

  if (g.mode == SyncMode::MidiBeat) {
    return;
  }

  const uint32_t barMs = barDurationMs();
  const uint8_t leftCount = effectivePulseCount(g.leftPulses);
  const uint8_t rightCount = effectivePulseCount(g.rightPulses);

  auto offsetFor = [barMs] (uint8_t index, uint8_t total) -> uint32_t {
    const uint8_t divisor = total == 0 ? 1 : total;
    return static_cast<uint32_t>((static_cast<uint64_t>(index) * barMs) / divisor);
  };

  if (g.sideMode == SideMode::Alternate) {
    for (uint8_t i = 0; i < leftCount; ++i) {
      insertOrMergeEvent(offsetFor(i, leftCount), false, false, i == 0);
    }
    for (uint8_t i = 0; i < rightCount; ++i) {
      insertOrMergeEvent(offsetFor(i, rightCount), false, false, i == 0);
    }

    bool nextLeft = true;
    for (uint8_t i = 0; i < g.eventCount; ++i) {
      g.events[i].fireLeft = nextLeft;
      g.events[i].fireRight = !nextLeft;
      nextLeft = !nextLeft;
    }
    return;
  }

  for (uint8_t i = 0; i < leftCount; ++i) {
    insertOrMergeEvent(offsetFor(i, leftCount), true, false, i == 0);
  }
  for (uint8_t i = 0; i < rightCount; ++i) {
    insertOrMergeEvent(offsetFor(i, rightCount), false, true, i == 0);
  }
}

void resetScheduler(uint32_t now) {
  g.barStartMs = now;
  g.beatCount = 0;
  rebuildBarSchedule();
}

void setLed(bool on) {
  digitalWrite(LED_BUILTIN, on ? LED_ON : LED_OFF);
}

void updatePairingLed(uint32_t now) {
  uint32_t phase = now % PAIR_CYCLE_MS;
  bool on = (phase >= PAIR_ON1_START && phase < PAIR_ON1_END) ||
            (phase >= PAIR_ON2_START && phase < PAIR_ON2_END);
  setLed(on);
}

// -------------------------------------------------------------
// DRV2605L helpers
// Adafruit_DRV2605::begin() accepts TwoWire* (lib v1.2.0+).
// -------------------------------------------------------------
static void drv_load_and_fire(Adafruit_DRV2605 &drv, const WaveformSequence &seq) {
  drv.stop();
  // Write all 8 slots — never break early. If a previous sequence had more
  // entries, leftover non-zero slot values would otherwise replay silently.
  for (uint8_t i = 0; i < 8; i++) {
    drv.setWaveform(i, seq.slots[i]);
  }
  drv.go();
}

static void drv_init_chip(Adafruit_DRV2605 &drv, arduino::MbedI2C &bus) {
  bus.begin();
  drv.begin(&bus);
  drv.useLRA();
  drv.selectLibrary(6);  // Library 6: LRA library

  // Configure voltage registers for Vybronics VLV101040A (1.8V rated, 2.25V max overdrive).
  // RATED_VOLTAGE  = V_rated  × 255 / 2.4  → 1.8  × 255 / 2.4 ≈ 0x79
  // OD_CLAMP       = V_od_max × 255 / 2.4  → 2.25 × 255 / 2.4 ≈ 0x97
  // Adjust these if you swap motors.
  drv.writeRegister8(0x16, 0x79);  // RATED_VOLTAGE
  drv.writeRegister8(0x17, 0x97);  // OD_CLAMP

  // Auto-calibrate: measures back-EMF to lock onto the LRA's resonant frequency.
  // Takes ~1.2 s at startup — essential for defined, crisp vibrations.
  drv.autoCalibrate();

  drv.setMode(DRV2605_MODE_INTTRIG);
}

void serviceMotorGate(Adafruit_DRV2605 &drv, MotorGate &gate, uint32_t now) {
  if (!gate.active) return;
  if (static_cast<int32_t>(now - gate.stopAtMs) < 0) return;
  drv.stop();
  gate.active = false;
}

void serviceMotorGates(uint32_t now) {
  serviceMotorGate(drvL, gateL, now);
  serviceMotorGate(drvR, gateR, now);
}

void stopAllMotors() {
  drvL.stop();
  drvR.stop();
  gateL.active = false;
  gateR.active = false;
}

void fireMotorPulse(Adafruit_DRV2605 &drv, MotorGate &gate, uint8_t patternIndex, bool isDownbeat, uint32_t now) {
  if (patternIndex >= PATTERN_COUNT) patternIndex = 1;
  // Use a single stronger hit for accents so the downbeat feels clear
  // without introducing the long smeared feel from multi-waveform sequences.
  const WaveformSequence &seq = isDownbeat ? WAVEFORMS_ACCENT[patternIndex]
                                           : WAVEFORMS_NORMAL[patternIndex];
  drv_load_and_fire(drv, seq);
  gate.active = true;
  gate.stopAtMs = now + PATTERN_CUTOFF_MS[patternIndex];
}

void fireLeftPulse(bool isDownbeat, uint32_t now) {
  fireMotorPulse(drvL, gateL, g.pattern, isDownbeat, now);
}

void fireRightPulse(bool isDownbeat, uint32_t now) {
  fireMotorPulse(drvR, gateR, g.pattern, isDownbeat, now);
}

void firePulse(bool isDownbeat, uint32_t now) {
  fireLeftPulse(isDownbeat, now);
  fireRightPulse(isDownbeat, now);
}

void fireScheduledEvent(const ScheduledEvent& event, uint32_t now) {
  if (event.fireLeft) {
    fireLeftPulse(event.isDownbeat, now);
  }
  if (event.fireRight) {
    fireRightPulse(event.isDownbeat, now);
  }
  g.beatCount = beatIndexForOffset(event.offsetMs);
  publishStatus();
}

void runEventScheduler(uint32_t now) {
  if (!g.running || g.mode == SyncMode::MidiBeat || g.eventCount == 0) {
    return;
  }

  const uint32_t barMs = barDurationMs();
  while (static_cast<int32_t>(now - (g.barStartMs + barMs)) >= 0) {
    g.barStartMs += barMs;
    g.nextEventIx = 0;
    g.beatCount = 0;
  }

  while (g.nextEventIx < g.eventCount) {
    const auto& event = g.events[g.nextEventIx];
    const uint32_t dueAt = g.barStartMs + event.offsetMs;
    if (static_cast<int32_t>(now - dueAt) < 0) {
      break;
    }

    fireScheduledEvent(event, now);
    ++g.nextEventIx;
  }
}

void playStartupCue() {
  WaveformSequence cue = {{ 1, 0 }};
  drv_load_and_fire(drvL, cue);
  delay(120);
  drv_load_and_fire(drvR, cue);
}

// -------------------------------------------------------------
// Battery
// XIAO nRF52840: VBAT → 1MΩ → P0.31(AIN7) → 510kΩ → GND, gated by P0.14.
// VBAT_ENABLE active LOW. ADC ref = 2.4 V (AR_INTERNAL2V4), 12-bit resolution.
// mV = raw × 2400 × (1000k+510k)/510k / 4096
//    = raw × 7106 / 4096  (7106 = round(2400 × 2.9608))
// LiPo usable range: 3300 mV (0%) → 4200 mV (100%)
// -------------------------------------------------------------
static uint8_t sampleBattery() {
  pinMode(VBAT_ENABLE, OUTPUT);
  digitalWrite(VBAT_ENABLE, LOW);   // enable voltage divider
  analogReadResolution(12);
  analogReference(AR_INTERNAL2V4);
  delay(5);                          // let ADC settle

  int32_t sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(PIN_VBAT);
  uint32_t raw = (uint32_t)(sum / 8);

  digitalWrite(VBAT_ENABLE, HIGH);  // disable divider (save power)

  uint32_t mv = (raw * 7106UL) / 4096UL;
  if (mv >= 4200) return 100;
  if (mv <= 3300) return 0;
  return (uint8_t)((mv - 3300UL) * 100UL / 900UL);
}

static bool readCharging() {
  return digitalRead(CHG_PIN) == LOW;
}

static uint32_t lastBatCheckMs = 0;
void updateBattery(uint32_t now) {
  if (now - lastBatCheckMs < BATTERY_SAMPLE_INTERVAL_MS) return;
  lastBatCheckMs = now;
  g.batteryPct = sampleBattery();
  g.charging   = readCharging();
}

// -------------------------------------------------------------
// BLE status notify
// Format: run=1;bpm=120;ts=4/4;mode=INTERNAL;side=UNISON;poly=4:4;beat=1;pattern=PULSE;bat=87;chg=0
// -------------------------------------------------------------
void publishStatus() {
  char buf[128];
  snprintf(buf, sizeof(buf),
    "run=%d;bpm=%u;ts=%u/%u;mode=%s;side=%s;poly=%u:%u;beat=%u;pattern=%s;bat=%u;chg=%d",
    g.running ? 1 : 0,
    g.bpm,
    g.timeSigNum, g.timeSigDen,
    modeName(g.mode),
    sideModeName(g.sideMode),
    effectivePulseCount(g.leftPulses),
    effectivePulseCount(g.rightPulses),
    (unsigned)(g.beatCount + 1),   // 1-indexed for display
    PATTERN_NAMES[g.pattern],
    g.batteryPct,
    g.charging ? 1 : 0
  );
  statusChar.writeValue(buf);
}

// -------------------------------------------------------------
// Command parser
// Supported commands (case-insensitive):
//   START
//   STOP
//   BPM:<20-300>
//   TS:<num>/<den>        e.g. TS:3/4
//   MODE:INTERNAL|MIDI_CLOCK|MIDI_BEAT
//   SIDE:UNISON|ALTERNATE
//   POLY:<left>:<right>   0 means "follow time signature beat count"
//   BEAT                  external beat trigger in MIDI_BEAT mode
//   PATTERN:<name|index>  e.g. PATTERN:PULSE or PATTERN:1
//   VIB:<name|index>      legacy alias for PATTERN
//   BAT?                  → immediate battery status
//   PING                  → PONG
//   TEST:LEFT|RIGHT|BOTH  → independent motor verification
// -------------------------------------------------------------
static uint8_t patternIndexByName(const String &name) {
  if (name == "ACCENT") return 15;
  for (uint8_t i = 0; i < PATTERN_COUNT; i++) {
    if (name == PATTERN_NAMES[i]) return i;
  }
  return 0xFF;
}

void applyCommand(const String &raw) {
  const uint32_t now = millis();
  String cmd = raw;
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "START") {
    g.running     = true;
    resetScheduler(now);
    publishStatus();
    return;
  }

  if (cmd == "STOP") {
    g.running   = false;
    g.beatCount = 0;
    g.nextEventIx = 0;
    stopAllMotors();
    publishStatus();
    return;
  }

  if (cmd.startsWith("BPM:")) {
    int v = cmd.substring(4).toInt();
    if (v < BPM_MIN) v = BPM_MIN;
    if (v > BPM_MAX) v = BPM_MAX;
    g.bpm = (uint16_t)v;
    resetScheduler(now);
    publishStatus();
    return;
  }

  if (cmd.startsWith("TS:")) {
    String ts  = cmd.substring(3);
    int    sep = ts.indexOf('/');
    if (sep > 0) {
      int num = ts.substring(0, sep).toInt();
      int den = ts.substring(sep + 1).toInt();
      if (num >= 1 && num <= 32 && den >= 1) {
        g.timeSigNum = (uint8_t)num;
        g.timeSigDen = (uint8_t)den;
        resetScheduler(now);
      }
    }
    publishStatus();
    return;
  }

  if (cmd.startsWith("MODE:")) {
    const String token = cmd.substring(5);
    if (token == "INTERNAL") {
      g.mode = SyncMode::Internal;
    } else if (token == "MIDI_CLOCK") {
      g.mode = SyncMode::MidiClock;
    } else if (token == "MIDI_BEAT") {
      g.mode = SyncMode::MidiBeat;
    }
    g.running = false;
    stopAllMotors();
    resetScheduler(now);
    publishStatus();
    return;
  }

  if (cmd.startsWith("SIDE:")) {
    const String token = cmd.substring(5);
    if (token == "ALTERNATE") {
      g.sideMode = SideMode::Alternate;
    } else if (token == "UNISON" || token == "BOTH") {
      g.sideMode = SideMode::Unison;
    }
    resetScheduler(now);
    publishStatus();
    return;
  }

  if (cmd.startsWith("POLY:")) {
    const String token = cmd.substring(5);
    const int sep = token.indexOf(':');
    if (sep > 0) {
      int left = token.substring(0, sep).toInt();
      int right = token.substring(sep + 1).toInt();
      if (left >= 0 && left <= 8 && right >= 0 && right <= 8) {
        g.leftPulses = (uint8_t)left;
        g.rightPulses = (uint8_t)right;
        resetScheduler(now);
      }
    }
    publishStatus();
    return;
  }

  if (cmd == "BEAT") {
    if (g.mode == SyncMode::MidiBeat && g.running) {
      const bool alternate = g.sideMode == SideMode::Alternate;
      const bool fireLeft = !alternate || ((g.beatCount % 2) == 0);
      const bool fireRight = !alternate || !fireLeft;
      const bool isDownbeat = (g.beatCount == 0);
      if (fireLeft) fireLeftPulse(isDownbeat, now);
      if (fireRight) fireRightPulse(isDownbeat, now);
      const uint8_t beatCount = g.timeSigNum == 0 ? 1 : g.timeSigNum;
      g.beatCount = (g.beatCount + 1) % beatCount;
      publishStatus();
    }
    return;
  }

  if (cmd.startsWith("PATTERN:") || cmd.startsWith("VIB:")) {
    String token = cmd.startsWith("PATTERN:") ? cmd.substring(8) : cmd.substring(4);
    bool   isNum = true;
    for (uint8_t i = 0; i < token.length(); i++) {
      if (!isDigit(token[i])) { isNum = false; break; }
    }
    if (isNum) {
      uint8_t idx = (uint8_t)token.toInt();
      if (idx < PATTERN_COUNT) g.pattern = idx;
    } else {
      uint8_t idx = patternIndexByName(token);
      if (idx != 0xFF) g.pattern = idx;
    }
    publishStatus();
    return;
  }

  if (cmd == "BAT?") {
    g.batteryPct = sampleBattery();
    g.charging   = readCharging();
    publishStatus();
    return;
  }

  if (cmd == "PING") {
    statusChar.writeValue("PONG");
    return;
  }

  if (cmd == "TEST:LEFT") {
    fireLeftPulse(true, now);
    statusChar.writeValue("TEST:LEFT");
    return;
  }

  if (cmd == "TEST:RIGHT") {
    fireRightPulse(true, now);
    statusChar.writeValue("TEST:RIGHT");
    return;
  }

  if (cmd == "TEST:BOTH") {
    firePulse(true, now);
    statusChar.writeValue("TEST:BOTH");
    return;
  }
}

// -------------------------------------------------------------
// Setup
// -------------------------------------------------------------
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  setLed(false);
  pinMode(CHG_PIN, INPUT);

  // I2C bus init: begin() is called inside drv_init_chip for each bus.
  // Wire  (TWI0): Left motor  — SDA=D4, SCL=D5  (BSP default pins)
  // Wire1 (TWI1): Right motor — remap to SDA=D2, SCL=D3 via setPins()
  drv_init_chip(drvL, Wire);
  drv_init_chip(drvR, WireR);
  playStartupCue();

  g.batteryPct = sampleBattery();
  g.charging   = readCharging();

  if (!BLE.begin()) { while (1) delay(250); }
  BLE.setLocalName("Rezo");
  BLE.setDeviceName("Rezo");
  BLE.setAdvertisedService(rezoService);
  rezoService.addCharacteristic(cmdChar);
  rezoService.addCharacteristic(statusChar);
  BLE.addService(rezoService);
  statusChar.writeValue("boot");
  BLE.advertise();

  resetScheduler(millis());
  publishStatus();
}

// -------------------------------------------------------------
// Main loop
// -------------------------------------------------------------
void loop() {
  BLE.poll();

  BLEDevice central    = BLE.central();
  const bool connected = central && central.connected();
  const uint32_t now   = millis();

  // -- LED: double-flash while waiting for a connection --
  if (!connected) {
    if (g.running || g.mode != SyncMode::Internal) {
      g.running = false;
      g.mode = SyncMode::Internal;
      stopAllMotors();
      resetScheduler(now);
    }
    updatePairingLed(now);
    delay(1);
    return;
  }
  setLed(false);

  // -- Commands --
  if (cmdChar.written()) {
    applyCommand(cmdChar.value());
  }

  // -- Battery (non-blocking, every 30 s) --
  updateBattery(now);

  // -- Keep haptics short even when the selected ROM effect wants to ring longer --
  serviceMotorGates(now);

  // -- Transport scheduler --
  runEventScheduler(now);

  delay(1);
}
