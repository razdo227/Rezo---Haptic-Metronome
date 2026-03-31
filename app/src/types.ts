export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';
export type SyncMode = 'INTERNAL' | 'MIDI_CLOCK' | 'MIDI_BEAT';
export type PatternId =
  | 'CLICK'
  | 'PULSE'
  | 'SOFT_BUMP'
  | 'SHARP'
  | 'STRONG_CLICK'
  | 'DOUBLE'
  | 'TRIPLET'
  | 'RAMP_UP'
  | 'RAMP_DOWN'
  | 'BUZZ_HOLD'
  | 'THUD'
  | 'HEARTBEAT'
  | 'LONG_BUZZ'
  | 'SOFT_CLICK'
  | 'POPS'
  | 'TRANSITION_HUM';

export interface FoundDevice {
  id: string;
  name: string;
  rssi: number;
}

export interface DeviceState {
  connectionState: ConnectionState;
  deviceId: string | null;
  isPlaying: boolean;
  bpm: number;
  syncMode: SyncMode;
  activePattern: PatternId;
  // local-only (not from firmware)
  currentBeat: number;
  timeSignatureNumerator: number;
  foundDevices: FoundDevice[];
  batteryPercent: number | null;
}

export type DeviceAction =
  | { type: 'SET_CONNECTION'; payload: { connectionState: ConnectionState; deviceId?: string | null } }
  | { type: 'UPDATE_FROM_STATUS'; payload: Partial<Pick<DeviceState, 'isPlaying' | 'bpm' | 'syncMode' | 'activePattern'>> }
  | { type: 'SET_BPM_OPTIMISTIC'; payload: number }
  | { type: 'SET_PATTERN_OPTIMISTIC'; payload: PatternId }
  | { type: 'SET_PLAYING_OPTIMISTIC'; payload: boolean }
  | { type: 'SET_BEAT'; payload: number }
  | { type: 'SET_TIME_SIG'; payload: number }
  | { type: 'ADD_FOUND_DEVICE'; payload: FoundDevice }
  | { type: 'CLEAR_FOUND_DEVICES' }
  | { type: 'SET_BATTERY'; payload: number };

export interface PatternInfo {
  id: PatternId;
  displayName: string;
  description: string;
}
