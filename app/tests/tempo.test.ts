import { describe, expect, it } from 'vitest';
import { bpmFromTapPoints, pushTap } from '../src/lib/tempo';

describe('tempo', () => {
  it('computes bpm from taps', () => {
    const points = [0, 500, 1000, 1500].map((at) => ({ at }));
    expect(bpmFromTapPoints(points)).toBe(120);
  });

  it('returns null for too few points', () => {
    expect(bpmFromTapPoints([{ at: 0 }, { at: 500 }])).toBeNull();
  });

  it('keeps tap window bounded', () => {
    const out = pushTap([{ at: 0 }, { at: 1000 }], 7000, 6000);
    expect(out.length).toBe(2);
    expect(out[0].at).toBe(1000);
    expect(out[1].at).toBe(7000);
  });
});
