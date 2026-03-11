export type TransportState = 'stopped' | 'running' | 'paused';

export type DeviceStatus = {
  bpm: number;
  beat: number;
  bar: number;
  batteryPct?: number;
  transport: TransportState;
};

export type MidiSyncEvent =
  | { type: 'clock' }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'continue' }
  | { type: 'spp'; position: number };
