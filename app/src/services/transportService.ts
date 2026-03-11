import type { DeviceStatus, TransportState } from '../types';

export interface TransportService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setTempo(bpm: number): Promise<void>;
  setTransport(state: TransportState): Promise<void>;
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

  async getStatus(): Promise<DeviceStatus> {
    return this.status;
  }
}
