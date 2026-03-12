import type { DeviceStatus, TransportState } from '../types';
import type { SyncMode } from '../lib/syncMode';

export type VibrationPattern =
  | 'CLICK'
  | 'PULSE'
  | 'ACCENT'
  | 'DOUBLE'
  | 'TRIPLET'
  | 'RAMP_UP'
  | 'RAMP_DOWN'
  | 'BUZZ_HOLD';

export interface TransportService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setTempo(bpm: number): Promise<void>;
  setTransport(state: TransportState): Promise<void>;
  setSyncMode(mode: SyncMode): Promise<void>;
  setPattern(pattern: VibrationPattern): Promise<void>;
  getStatus(): Promise<DeviceStatus>;
}

export class MockTransportService implements TransportService {
  private status: DeviceStatus = { bpm: 120, beat: 1, bar: 1, batteryPct: 100, transport: 'stopped' };

  async connect() {}
  async disconnect() {}

  async setTempo(bpm: number) {
    this.status.bpm = bpm;
  }

  async setTransport(state: TransportState) {
    this.status.transport = state;
  }

  async setSyncMode(_: SyncMode) {}
  async setPattern(_: VibrationPattern) {}

  async getStatus(): Promise<DeviceStatus> {
    return this.status;
  }
}
