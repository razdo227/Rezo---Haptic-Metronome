import { PatternId, PatternInfo } from '../types';

export const BLE_DEVICE_NAME = 'Rezo';

export const BLE_SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214';
export const BLE_CMD_CHAR_UUID = '19b10001-e8f2-537e-4f6c-d104768a1214';
export const BLE_STATUS_CHAR_UUID = '19b10002-e8f2-537e-4f6c-d104768a1214';

export const BLE_MTU = 64;

export const BPM_MIN = 20;
export const BPM_MAX = 300;
export const BPM_DEFAULT = 120;

export const COMMANDS = {
  START: 'START',
  STOP: 'STOP',
  BEAT: 'BEAT',
  PING: 'PING',
  BPM: (bpm: number) => `BPM:${bpm}`,
  TS: (numerator: number, denominator: number = 4) => `TS:${numerator}/${denominator}`,
  PATTERN: (name: PatternId) => `PATTERN:${name}`,
  MODE: (mode: string) => `MODE:${mode}`,
  SIDE: (mode: 'UNISON' | 'ALTERNATE') => `SIDE:${mode}`,
  POLY: (left: number, right: number) => `POLY:${left}:${right}`,
} as const;

const CANONICAL_PATTERN_IDS: PatternId[] = [
  'CLICK',
  'PULSE',
  'SOFT_BUMP',
  'SHARP',
  'DOUBLE',
  'TRIPLET',
  'RAMP_UP',
  'RAMP_DOWN',
  'BUZZ_HOLD',
  'THUD',
  'HEARTBEAT',
  'LONG_BUZZ',
  'SOFT_CLICK',
  'POPS',
  'TRANSITION_HUM',
  'STRONG_CLICK',
];

export const PATTERNS: PatternInfo[] = [
  { id: 'SOFT_CLICK', displayName: 'Soft Click', description: 'Lightest whisper tap' },
  { id: 'CLICK', displayName: 'Click', description: 'Clean, fast snap' },
  { id: 'SHARP', displayName: 'Sharp', description: 'Hard, pointed attack' },
  { id: 'PULSE', displayName: 'Pulse', description: 'Solid medium beat' },
  { id: 'SOFT_BUMP', displayName: 'Soft Bump', description: 'Full but gentle push' },
  { id: 'STRONG_CLICK', displayName: 'Accent', description: 'Heaviest defined hit' },
  { id: 'THUD', displayName: 'Thud', description: 'Deep low-frequency tap' },
];

export function normalizePatternId(value: string): PatternId {
  if (value === 'ACCENT') return 'STRONG_CLICK';
  if (CANONICAL_PATTERN_IDS.includes(value as PatternId)) return value as PatternId;
  return 'PULSE';
}

export const SYNC_MODES = [
  { id: 'INTERNAL',   label: 'INTERNAL' },
  { id: 'MIDI_CLOCK', label: 'MIDI CLOCK' },
  { id: 'MIDI_BEAT',  label: 'MIDI BEAT' },
] as const;

export const TIME_SIGNATURES = [
  { numerator: 2, label: '2/4' },
  { numerator: 3, label: '3/4' },
  { numerator: 4, label: '4/4' },
  { numerator: 5, label: '5/4' },
  { numerator: 6, label: '6/8' },
  { numerator: 7, label: '7/8' },
] as const;

export const RECONNECT_BASE_DELAY_MS = 1000;
export const RECONNECT_MAX_DELAY_MS = 30000;
export const RECONNECT_MAX_ATTEMPTS = 10;
