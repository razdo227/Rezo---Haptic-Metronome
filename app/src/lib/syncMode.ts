export type SyncMode = 'INTERNAL' | 'MIDI_CLOCK' | 'MIDI_BEAT';

export const syncModeLabel: Record<SyncMode, string> = {
  INTERNAL: 'Internal',
  MIDI_CLOCK: 'MIDI Clock',
  MIDI_BEAT: 'MIDI Beat',
};
