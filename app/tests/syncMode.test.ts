import { describe, expect, it } from 'vitest';
import { syncModeLabel } from '../src/lib/syncMode';

describe('sync mode labels', () => {
  it('keeps the reduced mobile sync options stable', () => {
    expect(syncModeLabel).toEqual({
      INTERNAL: 'Internal',
      BLE_MIDI: 'BLE MIDI'
    });
  });
});
