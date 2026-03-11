import { describe, expect, it } from 'vitest';
import { MidiClockTracker } from '../src/lib/midiClock';

describe('midi clock', () => {
  it('estimates bpm from 24ppqn pulses', () => {
    const t = new MidiClockTracker();
    // 120 BPM => quarter note 500ms => pulse every 20.833ms
    let now = 0;
    for (let i = 0; i < 30; i++) {
      t.onClock(now);
      now += 20.833;
    }
    const bpm = t.getBpm();
    expect(bpm).not.toBeNull();
    expect(Math.abs((bpm || 0) - 120)).toBeLessThanOrEqual(1);
  });
});
