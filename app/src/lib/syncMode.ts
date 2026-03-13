export type SyncMode = 'INTERNAL' | 'BLE_MIDI';

export const syncModeLabel: Record<SyncMode, string> = {
  INTERNAL: 'Internal',
  BLE_MIDI: 'BLE MIDI'
};
