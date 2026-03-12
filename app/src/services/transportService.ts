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

const mapSyncModeToFw = (mode: SyncMode): string => {
  if (mode === 'INTERNAL') return 'INTERNAL';
  if (mode === 'MIDI_CLOCK_FOLLOW') return 'MIDI_CLOCK';
  return 'MIDI_BEAT';
};

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

export class BleTextTransportService implements TransportService {
  private device: any = null;
  private char: any = null;

  // UUIDs aligned with firmware/arduino sketch
  private readonly serviceUUID = '19b10000-e8f2-537e-4f6c-d104768a1214';
  private readonly cmdCharUUID = '19b10001-e8f2-537e-4f6c-d104768a1214';

  async connect(): Promise<void> {
    // Runtime require keeps bundling predictable across RN targets.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BleManager } = require('react-native-ble-plx');
    const manager = new BleManager();

    await manager.startDeviceScan([this.serviceUUID], null, async (error: any, device: any) => {
      if (error || !device) return;
      if ((device.name || '').includes('RezoHaptic')) {
        manager.stopDeviceScan();
        this.device = await device.connect();
        await this.device.discoverAllServicesAndCharacteristics();
        this.char = await this.device.writeCharacteristicWithResponseForService(
          this.serviceUUID,
          this.cmdCharUUID,
          this.toBase64('PING')
        );
      }
    });

    // soft wait for scan/connection path
    await new Promise((r) => setTimeout(r, 2500));
  }

  async disconnect(): Promise<void> {
    if (this.device?.isConnected?.()) {
      await this.device.cancelConnection();
    }
  }

  private toBase64(input: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = unescape(encodeURIComponent(input));
    let output = '';
    for (let block = 0, charCode: number, idx = 0, map = chars; str.charAt(idx | 0) || ((map = '='), idx % 1); output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))) {
      charCode = str.charCodeAt((idx += 3 / 4));
      if (charCode > 0xff) throw new Error('Base64 encode failed');
      block = (block << 8) | charCode;
    }
    return output;
  }

  private async send(cmd: string): Promise<void> {
    if (!this.device) return;
    const base64 = this.toBase64(cmd);
    await this.device.writeCharacteristicWithResponseForService(this.serviceUUID, this.cmdCharUUID, base64);
  }

  async setTempo(bpm: number): Promise<void> {
    await this.send(`BPM:${Math.max(20, Math.min(300, bpm))}`);
  }

  async setTransport(state: TransportState): Promise<void> {
    await this.send(state === 'running' ? 'START' : 'STOP');
  }

  async setSyncMode(mode: SyncMode): Promise<void> {
    await this.send(`MODE:${mapSyncModeToFw(mode)}`);
  }

  async setPattern(pattern: VibrationPattern): Promise<void> {
    await this.send(`PATTERN:${pattern}`);
  }

  async getStatus(): Promise<DeviceStatus> {
    return { bpm: 120, beat: 1, bar: 1, batteryPct: 100, transport: 'stopped' };
  }
}
