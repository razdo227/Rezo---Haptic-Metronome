import { describe, expect, it } from 'vitest';
import { applyMidiEvent, defaultSyncRuntime, shouldTimeoutBeatTrigger } from '../src/lib/syncMode';

describe('sync mode runtime', () => {
  it('enables running on MIDI start', () => {
    const s = applyMidiEvent(defaultSyncRuntime(), { type: 'start' }, 1000);
    expect(s.running).toBe(true);
  });

  it('tracks per-beat trigger timestamps in MIDI_BEAT_TRIGGER mode', () => {
    const base = { ...defaultSyncRuntime(), mode: 'MIDI_BEAT_TRIGGER' as const, running: true };
    const s = applyMidiEvent(base, { type: 'beat' }, 5000);
    expect(s.lastBeatAt).toBe(5000);
  });

  it('times out stale beat-trigger mode', () => {
    const s = { ...defaultSyncRuntime(), mode: 'MIDI_BEAT_TRIGGER' as const, running: true, lastBeatAt: 1000, beatTriggerTimeoutMs: 1500 };
    expect(shouldTimeoutBeatTrigger(s, 2600)).toBe(true);
  });
});
