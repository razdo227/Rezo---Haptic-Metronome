import type { DeviceStatus, TransportState } from '../types';
import type { SyncMode } from '../lib/syncMode';
import { BlePairingService } from './blePairing';

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
  setTempo(bpm: number): Promise<void>;
  setTransport(state: TransportState): Promise<void>;
  setSyncMode(mode: SyncMode): Promise<void>;
  setPattern(pattern: VibrationPattern): Promise<void>;
  getStatus(): Promise<DeviceStatus>;
}

const pairing = new BlePairingService();

const mapSyncModeToFw = (mode: SyncMode): string => {
  if (mode === 'INTERNAL') return 'INTERNAL';
  if (mode === 'MIDI_CLOCK_FOLLOW') return 'MIDI_CLOCK';
  return 'MIDI_BEAT';
};

export class RezoTransportService implements TransportService {
  async setTempo(bpm: number) {
    await pairing.sendCommand(`BPM:${Math.max(20, Math.min(300, bpm))}`);
  }

  async setTransport(state: TransportState) {
    await pairing.sendCommand(state === 'running' ? 'START' : 'STOP');
  }

  async setSyncMode(mode: SyncMode) {
    await pairing.sendCommand(`MODE:${mapSyncModeToFw(mode)}`);
  }

  async setPattern(pattern: VibrationPattern) {
    await pairing.sendCommand(`PATTERN:${pattern}`);
  }

  async getStatus(): Promise<DeviceStatus> {
    return { bpm: 120, beat: 1, bar: 1, batteryPct: 100, transport: 'stopped' };
  }
}

export { pairing };
