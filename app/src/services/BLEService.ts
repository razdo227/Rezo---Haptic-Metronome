import { BleManager, Device, Characteristic, BleError, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';
import {
  BLE_DEVICE_NAME,
  BLE_SERVICE_UUID,
  BLE_CMD_CHAR_UUID,
  BLE_STATUS_CHAR_UUID,
  BLE_MTU,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_MAX_ATTEMPTS,
} from '../constants/ble';
import { ConnectionState } from '../types';

type StatusUpdateCallback = (raw: string) => void;
type ConnectionChangeCallback = (state: ConnectionState, deviceId?: string | null) => void;

class BLEService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private statusSubscription: { remove: () => void } | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isDestroyed = false;
  private isReconnecting = false;

  public onStatusUpdate: StatusUpdateCallback | null = null;
  public onConnectionChange: ConnectionChangeCallback | null = null;
  public onDeviceFound: ((device: { id: string; name: string; rssi: number }) => void) | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    const sdkVersion =
      typeof Platform.Version === 'string'
        ? parseInt(Platform.Version, 10)
        : Platform.Version;

    if (sdkVersion >= 31) {
      // Android 12+
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      // Android < 12
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  }

  private async waitForBluetooth(): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const sub = this.manager.onStateChange((state) => {
        if (state === State.PoweredOn) {
          sub.remove();
          if (timeout) clearTimeout(timeout);
          resolve();
        } else if (state === State.Unsupported || state === State.Unauthorized) {
          sub.remove();
          if (timeout) clearTimeout(timeout);
          reject(new Error(`Bluetooth state: ${state}`));
        }
      }, true);
      timeout = setTimeout(() => {
        sub.remove();
        reject(new Error('Bluetooth state timeout'));
      }, 10000);
    });
  }

  async startScan(): Promise<void> {
    if (this.isDestroyed) return;

    const hasPerms = await this.requestPermissions();
    if (!hasPerms) {
      this.onConnectionChange?.('disconnected', null);
      throw new Error('Bluetooth permissions denied');
    }

    await this.waitForBluetooth();

    this.onConnectionChange?.('scanning');

    // Clear any existing scan timeout
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    this.manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error: BleError | null, device: Device | null) => {
        if (error) {
          this.onConnectionChange?.('disconnected', null);
          return;
        }
        if (device && device.name) {
          this.onDeviceFound?.({
            id: device.id,
            name: device.name ?? 'Unknown',
            rssi: device.rssi ?? 0,
          });
        }
      }
    );

    // Auto-stop scan after 30 seconds (only emit disconnected if we never connected)
    this.scanTimeout = setTimeout(() => {
      this.manager.stopDeviceScan();
      this.scanTimeout = null;
      if (!this.connectedDevice) {
        this.onConnectionChange?.('disconnected', null);
      }
    }, 30000);
  }

  async connect(deviceId: string): Promise<void> {
    if (this.isDestroyed) return;

    // Stop scanning and clear scan timeout before connecting
    this.manager.stopDeviceScan();
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    try {
      this.onConnectionChange?.('connecting', deviceId);

      const device = await this.manager.connectToDevice(deviceId, {
        requestMTU: BLE_MTU,
      });

      await device.discoverAllServicesAndCharacteristics();

      this.connectedDevice = device;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;

      // Subscribe to STATUS characteristic
      this.subscribeToStatus(device);

      // Handle disconnection
      device.onDisconnected((error: BleError | null, disconnectedDevice: Device) => {
        this.connectedDevice = null;
        this.statusSubscription?.remove();
        this.statusSubscription = null;
        this.onConnectionChange?.('disconnected', null);
        if (!this.isDestroyed && !this.isReconnecting) {
          this.scheduleReconnect(disconnectedDevice.id);
        }
      });

      this.onConnectionChange?.('connected', deviceId);
    } catch (error) {
      this.onConnectionChange?.('disconnected', null);
      throw error;
    }
  }

  private subscribeToStatus(device: Device): void {
    try {
      this.statusSubscription?.remove();
      this.statusSubscription = device.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_STATUS_CHAR_UUID,
        (error: BleError | null, characteristic: Characteristic | null) => {
          if (error || !characteristic?.value) return;
          const raw = Buffer.from(characteristic.value, 'base64').toString('utf8');
          this.onStatusUpdate?.(raw);
        }
      );
    } catch {
      // Status subscription is optional — silently ignore errors
    }
  }

  scheduleReconnect(deviceId: string): void {
    if (this.isDestroyed || this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      return;
    }

    this.isReconnecting = true;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY_MS
    );
    this.reconnectAttempts += 1;

    this.reconnectTimeout = setTimeout(async () => {
      if (this.isDestroyed) return;
      try {
        await this.connect(deviceId);
      } catch {
        if (!this.isDestroyed) {
          this.scheduleReconnect(deviceId);
        }
      }
    }, delay);
  }

  async sendCommand(cmd: string): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('Not connected to device');
    }

    const base64Value = Buffer.from(cmd, 'utf8').toString('base64');
    await this.connectedDevice.writeCharacteristicWithResponseForService(
      BLE_SERVICE_UUID,
      BLE_CMD_CHAR_UUID,
      base64Value
    );
  }

  disconnect(): void {
    this.isReconnecting = false;
    this.reconnectAttempts = RECONNECT_MAX_ATTEMPTS; // prevent auto-reconnect

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    this.manager.stopDeviceScan();
    this.statusSubscription?.remove();
    this.statusSubscription = null;

    const device = this.connectedDevice;
    this.connectedDevice = null;

    if (device) {
      device.cancelConnection().catch(() => {});
    }

    this.onConnectionChange?.('disconnected', null);
  }

  cancelScan(): void {
    this.manager.stopDeviceScan();
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
    if (!this.connectedDevice) {
      this.onConnectionChange?.('disconnected', null);
    }
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
    // Only emit disconnected if we're not already connected/connecting
    if (!this.connectedDevice) {
      this.onConnectionChange?.('disconnected', null);
    }
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    this.manager.destroy();
  }
}

// Singleton
const bleService = new BLEService();
export default bleService;
