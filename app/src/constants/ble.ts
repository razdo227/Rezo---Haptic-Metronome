import { PatternInfo } from '../types';

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
  PATTERN: (name: string) => `PATTERN:${name}`,
  MODE: (mode: string) => `MODE:${mode}`,
} as const;

export const PATTERNS: PatternInfo[] = [
  { id: 'CLICK',     displayName: 'Click',      description: 'Sharp click' },
  { id: 'PULSE',     displayName: 'Pulse',       description: 'Clean pulse' },
  { id: 'ACCENT',    displayName: 'Accent',      description: 'Strong accent' },
  { id: 'DOUBLE',    displayName: 'Double',      description: 'Double tap' },
  { id: 'TRIPLET',   displayName: 'Triplet',     description: 'Triple tap' },
  { id: 'RAMP_UP',   displayName: 'Ramp Up',     description: 'Rising intensity' },
  { id: 'RAMP_DOWN', displayName: 'Ramp Down',   description: 'Falling intensity' },
  { id: 'BUZZ_HOLD', displayName: 'Buzz Hold',   description: 'Sustained buzz' },
];

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
