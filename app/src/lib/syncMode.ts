import type { MidiSyncEvent } from '../types';

export type SyncMode = 'INTERNAL' | 'MIDI_CLOCK_FOLLOW' | 'MIDI_BEAT_TRIGGER';

export type SyncRuntime = {
  mode: SyncMode;
  bpm: number;
  running: boolean;
  lastBeatAt?: number;
  beatTriggerTimeoutMs: number;
};

export function defaultSyncRuntime(): SyncRuntime {
  return {
    mode: 'INTERNAL',
    bpm: 120,
    running: false,
    beatTriggerTimeoutMs: 2000
  };
}

export function applyMidiEvent(state: SyncRuntime, event: MidiSyncEvent, atMs: number): SyncRuntime {
  switch (event.type) {
    case 'start':
    case 'continue':
      return { ...state, running: true };
    case 'stop':
      return { ...state, running: false };
    case 'beat':
      if (state.mode === 'MIDI_BEAT_TRIGGER') {
        return { ...state, running: true, lastBeatAt: atMs };
      }
      return state;
    case 'clock':
    case 'spp':
    default:
      return state;
  }
}

export function shouldTimeoutBeatTrigger(state: SyncRuntime, nowMs: number): boolean {
  if (state.mode !== 'MIDI_BEAT_TRIGGER') return false;
  if (!state.running) return false;
  if (!state.lastBeatAt) return false;
  return nowMs - state.lastBeatAt > state.beatTriggerTimeoutMs;
}
