export type OnsetConfig = {
  threshold: number;
  refractoryMs: number;
};

export function detectOnsets(
  samples: Array<{ at: number; level: number }>,
  cfg: OnsetConfig = { threshold: 0.6, refractoryMs: 120 }
): number[] {
  const hits: number[] = [];
  let last = -Infinity;
  for (const s of samples) {
    if (s.level >= cfg.threshold && s.at - last >= cfg.refractoryMs) {
      hits.push(s.at);
      last = s.at;
    }
  }
  return hits;
}
