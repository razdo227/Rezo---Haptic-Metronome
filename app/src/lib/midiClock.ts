export class MidiClockTracker {
  private ppqn = 24;
  private pulses: number[] = [];

  onClock(atMs: number) {
    this.pulses.push(atMs);
    if (this.pulses.length > 96) this.pulses.shift();
  }

  getBpm(): number | null {
    if (this.pulses.length < this.ppqn + 1) return null;
    const recent = this.pulses.slice(-this.ppqn - 1);
    const intervals: number[] = [];
    for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1]);
    const avgPulseMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (!Number.isFinite(avgPulseMs) || avgPulseMs <= 0) return null;
    return Math.round(60000 / (avgPulseMs * this.ppqn));
  }
}
