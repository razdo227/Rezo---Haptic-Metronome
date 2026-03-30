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
// DRV2605L ROM waveform IDs (Texas Instruments effect library 1)
// Slots: up to 8 waveforms, 0-terminated.
// WAVEFORMS_ACCENT[i] is the downbeat (beat 1) variant of pattern i.
// -------------------------------------------------------------
struct WaveformSequence {
  uint8_t slots[8];
};

static const WaveformSequence WAVEFORMS_NORMAL[] = {
  // 0  CLICK          — short crisp tap
  {{ 1, 0 }},
  // 1  PULSE          — medium rounded bump
  {{ 47, 0 }},
  // 2  SOFT_BUMP      — gentle nudge
  {{ 14, 0 }},
  // 3  SHARP          — fast sharp tick
  {{ 4, 0 }},
  // 4  DOUBLE         — two rapid taps
  {{ 1, 1, 0 }},
  // 5  TRIPLET        — three rapid taps
  {{ 1, 1, 1, 0 }},
  // 6  RAMP_UP        — swells in
  {{ 74, 0 }},
  // 7  RAMP_DOWN      — fades out
  {{ 75, 0 }},
  // 8  BUZZ_HOLD      — sustained buzz
  {{ 52, 0 }},
  // 9  THUD           — deep low-frequency hit
  {{ 58, 0 }},
  // 10 HEARTBEAT      — ba-bum
  {{ 14, 14, 0 }},
  // 11 LONG_BUZZ      — extended hold buzz
  {{ 84, 0 }},
  // 12 SOFT_CLICK     — very light tap
  {{ 7, 0 }},
  // 13 POPS           — two pops
  {{ 18, 18, 0 }},
  // 14 TRANSITION_HUM — smooth ramp with hold
  {{ 56, 47, 0 }},
  // 15 STRONG_CLICK   — firm single hit
  {{ 16, 0 }},
};
constexpr uint8_t PATTERN_COUNT = sizeof(WAVEFORMS_NORMAL) / sizeof(WAVEFORMS_NORMAL[0]);

static const WaveformSequence WAVEFORMS_ACCENT[] = {
  // 0  CLICK accent
  {{ 16, 1, 0 }},
  // 1  PULSE accent
  {{ 58, 47, 0 }},
  // 2  SOFT_BUMP accent
  {{ 47, 14, 0 }},
  // 3  SHARP accent
  {{ 16, 4, 0 }},
  // 4  DOUBLE accent
  {{ 16, 1, 1, 0 }},
  // 5  TRIPLET accent
  {{ 16, 1, 1, 1, 0 }},
  // 6  RAMP_UP accent
  {{ 58, 74, 0 }},
  // 7  RAMP_DOWN accent
  {{ 58, 75, 0 }},
  // 8  BUZZ_HOLD accent
  {{ 58, 52, 0 }},
  // 9  THUD accent
  {{ 72, 58, 0 }},
  // 10 HEARTBEAT accent
  {{ 58, 14, 14, 0 }},
  // 11 LONG_BUZZ accent
  {{ 58, 84, 0 }},
  // 12 SOFT_CLICK accent
  {{ 14, 7, 0 }},
  // 13 POPS accent
  {{ 16, 18, 18, 0 }},
  // 14 TRANSITION_HUM accent
  {{ 58, 56, 47, 0 }},
  // 15 STRONG_CLICK accent
  {{ 72, 16, 0 }},
};

static const char* PATTERN_NAMES[] = {
  "CLICK", "PULSE", "SOFT_BUMP", "SHARP", "DOUBLE", "TRIPLET",
  "RAMP_UP", "RAMP_DOWN", "BUZZ_HOLD", "THUD", "HEARTBEAT",
  "LONG_BUZZ", "SOFT_CLICK", "POPS", "TRANSITION_HUM", "STRONG_CLICK"
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
  uint8_t  beatCount   = 0;   // current beat within bar (0-indexed)
  uint32_t nextPulseMs = 0;
  uint8_t  batteryPct  = 0;
  bool     charging    = false;
};

RezoState g;

// Two independent driver objects, each bound to its own I2C bus.
Adafruit_DRV2605 drvL;  // left  — Wire  (D4/D5)
Adafruit_DRV2605 drvR;  // right — WireR (D2/D3)

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
  drv.useLRA();          // VLV101040A is an LRA — enables back-EMF resonance tracking
  drv.selectLibrary(6);  // Library 6: LRA waveforms (library 1 is ERM only)
  drv.setMode(DRV2605_MODE_INTTRIG);
}

void firePulse(bool isDownbeat) {
  const WaveformSequence &seq = isDownbeat ? WAVEFORMS_ACCENT[g.pattern]
                                            : WAVEFORMS_NORMAL[g.pattern];
  drv_load_and_fire(drvL, seq);
  drv_load_and_fire(drvR, seq);
}

void playStartupCue() {
  WaveformSequence cue = {{ 47, 0 }};
  drv_load_and_fire(drvL, cue);
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
// Format: run=1;bpm=120;ts=4/4;beat=1;pat=PULSE;bat=87;chg=0
// -------------------------------------------------------------
void publishStatus() {
  char buf[128];
  snprintf(buf, sizeof(buf),
    "run=%d;bpm=%u;ts=%u/%u;beat=%u;pat=%s;bat=%u;chg=%d",
    g.running ? 1 : 0,
    g.bpm,
    g.timeSigNum, g.timeSigDen,
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
//   PATTERN:<name|index>  e.g. PATTERN:PULSE or PATTERN:1
//   BAT?                  → immediate battery status
//   PING                  → PONG
// -------------------------------------------------------------
static uint8_t patternIndexByName(const String &name) {
  for (uint8_t i = 0; i < PATTERN_COUNT; i++) {
    if (name == PATTERN_NAMES[i]) return i;
  }
  return 0xFF;
}

void applyCommand(const String &raw) {
  String cmd = raw;
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "START") {
    g.running     = true;
    g.beatCount   = 0;
    g.nextPulseMs = millis();
    publishStatus();
    return;
  }

  if (cmd == "STOP") {
    g.running   = false;
    g.beatCount = 0;
    publishStatus();
    return;
  }

  if (cmd.startsWith("BPM:")) {
    int v = cmd.substring(4).toInt();
    if (v < BPM_MIN) v = BPM_MIN;
    if (v > BPM_MAX) v = BPM_MAX;
    g.bpm = (uint16_t)v;
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
        g.beatCount  = 0;
      }
    }
    publishStatus();
    return;
  }

  if (cmd.startsWith("PATTERN:")) {
    String token = cmd.substring(8);
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

  g.nextPulseMs = millis() + beatIntervalMs(g.bpm);
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

  // -- Transport scheduler --
  if (g.running) {
    if ((int32_t)(now - g.nextPulseMs) >= 0) {
      bool isDownbeat = (g.beatCount == 0);
      firePulse(isDownbeat);
      g.beatCount    = (g.beatCount + 1) % g.timeSigNum;
      g.nextPulseMs += beatIntervalMs(g.bpm);
      publishStatus();
    }
  }

  delay(1);
}
