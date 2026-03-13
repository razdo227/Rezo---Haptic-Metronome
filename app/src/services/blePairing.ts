import { Platform, PermissionsAndroid } from 'react-native';

export type DiscoveredDevice = { id: string; name: string };

export class BlePairingService {
  private manager: any = null;
  private connected: any = null;
  private scanning = false;
  private readonly serviceUUID = '19b10000-e8f2-537e-4f6c-d104768a1214';
  private readonly cmdCharUUID = '19b10001-e8f2-537e-4f6c-d104768a1214';

  private ensureManager() {
    if (this.manager || Platform.OS === 'web') return;
    // Lazy load only when pairing flow is used.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BleManager } = require('react-native-ble-plx');
    this.manager = new BleManager();
  }

  async requestPermissionsIfNeeded() {
    if (Platform.OS !== 'android') return;
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    ]);
    const denied = Object.values(result).some((value) => value !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied) {
      throw new Error('Bluetooth permissions not granted');
    }
  }

  async scanDevices(timeoutMs = 6000): Promise<DiscoveredDevice[]> {
    if (Platform.OS === 'web') {
      return [{ id: 'mock-rezo-1', name: 'RezoHaptic (Mock)' }];
    }

    await this.requestPermissionsIfNeeded();
    this.ensureManager();
    this.stopScan();

    const out = new Map<string, DiscoveredDevice>();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.stopScan();
        resolve();
      }, timeoutMs);

      this.scanning = true;
      this.manager.startDeviceScan([this.serviceUUID], null, (error: any, device: any) => {
        if (error) {
          clearTimeout(timer);
          this.stopScan();
          resolve();
          return;
        }
        if (!device) return;
        const name = device.localName || device.name || 'Unknown';
        if (name.toLowerCase().includes('rezo') || name.toLowerCase().includes('haptic')) {
          out.set(device.id, { id: device.id, name });
        }
      });
    });

    return Array.from(out.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  stopScan() {
    if (!this.scanning) return;
    this.manager?.stopDeviceScan();
    this.scanning = false;
  }

  async connect(deviceId: string): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    this.ensureManager();
    this.stopScan();
    try {
      const device = await this.manager.connectToDevice(deviceId, { timeout: 12000 });
      await device.discoverAllServicesAndCharacteristics();
      this.connected = device;
      return true;
    } catch {
      return false;
    }
  }

  async disconnect() {
    try {
      this.stopScan();
      if (this.connected) {
        await this.connected.cancelConnection();
      }
    } catch {}
    this.connected = null;
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

  async sendCommand(cmd: string) {
    if (Platform.OS === 'web' || !this.connected) return;
    const payload = this.toBase64(cmd);
    await this.connected.writeCharacteristicWithResponseForService(this.serviceUUID, this.cmdCharUUID, payload);
  }

  async destroy() {
    await this.disconnect();
    this.manager?.destroy?.();
    this.manager = null;
  }
}
