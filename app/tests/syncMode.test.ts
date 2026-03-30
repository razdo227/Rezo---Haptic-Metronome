import { describe, expect, it } from 'vitest';
import { syncModeLabel } from '../src/lib/syncMode';

describe('sync mode labels', () => {
  it('keeps the firmware sync mode labels stable', () => {
    expect(syncModeLabel).toEqual({
      INTERNAL: 'Internal',
      MIDI_CLOCK: 'MIDI Clock',
      MIDI_BEAT: 'MIDI Beat',
    });
  });
});
