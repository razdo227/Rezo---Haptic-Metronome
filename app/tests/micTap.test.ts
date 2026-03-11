import { describe, expect, it } from 'vitest';
import { detectOnsets } from '../src/lib/micTap';

describe('mic onset', () => {
  it('detects above-threshold pulses with refractory window', () => {
    const hits = detectOnsets([
      { at: 0, level: 0.2 },
      { at: 100, level: 0.8 },
      { at: 150, level: 0.9 },
      { at: 300, level: 0.85 }
    ]);
    expect(hits).toEqual([100, 300]);
  });
});
