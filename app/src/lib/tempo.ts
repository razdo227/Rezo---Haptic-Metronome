export type TapPoint = { at: number };

export function bpmFromTapPoints(points: TapPoint[], min = 20, max = 300): number | null {
  if (points.length < 4) return null;
  const intervals: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = points[i].at - points[i - 1].at;
    if (d > 0) intervals.push(d);
  }
  if (!intervals.length) return null;
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60000 / avg);
  return Math.max(min, Math.min(max, bpm));
}

export function pushTap(points: TapPoint[], at: number, windowMs = 6000, maxPoints = 8): TapPoint[] {
  const fresh = points.filter((p) => at - p.at <= windowMs);
  return [...fresh, { at }].slice(-maxPoints);
}
