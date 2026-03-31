export type ConditionKey = 'A' | 'B' | 'C' | 'D' | 'E';
export type TrialPhase = 'SYNC' | 'PERTURB' | 'CONTINUATION';
export type EventType = 'CUE' | 'TAP';
export type TrialStatus = 'IDLE' | 'RUNNING' | 'DONE';

export interface Condition {
  key: ConditionKey;
  name: string;
  description: string;
  bpm1: number;
  bpm2: number;
  syncBeats: number;
  perturbBeats: number;
  contBeats: number;
}

export const CONDITIONS: Record<ConditionKey, Condition> = {
  A: {
    key: 'A',
    name: 'Baseline',
    description: '80 BPM steady — no tempo change',
    bpm1: 80, bpm2: 80,
    syncBeats: 16, perturbBeats: 0, contBeats: 8,
  },
  B: {
    key: 'B',
    name: 'Acceleration +25%',
    description: '80 → 100 BPM mid-trial',
    bpm1: 80, bpm2: 100,
    syncBeats: 16, perturbBeats: 8, contBeats: 8,
  },
  C: {
    key: 'C',
    name: 'Deceleration −20%',
    description: '80 → 64 BPM mid-trial',
    bpm1: 80, bpm2: 64,
    syncBeats: 16, perturbBeats: 8, contBeats: 8,
  },
  D: {
    key: 'D',
    name: 'Fast Baseline',
    description: '100 BPM steady — no tempo change',
    bpm1: 100, bpm2: 100,
    syncBeats: 16, perturbBeats: 0, contBeats: 8,
  },
  E: {
    key: 'E',
    name: 'Decel from Fast',
    description: '120 → 96 BPM mid-trial',
    bpm1: 120, bpm2: 96,
    syncBeats: 16, perturbBeats: 8, contBeats: 8,
  },
};

export const CONDITION_KEYS = Object.keys(CONDITIONS) as ConditionKey[];

export interface ResearchEvent {
  seq: number;
  type: EventType;
  beat: number;           // beat number for CUE; -1 for TAP
  phase: TrialPhase;
  firmwareTimestampMs: number;
  appTimestampMs: number;
  asynchronyMs: number | null; // TAP − preceding CUE; null for CUE events
}

export interface CompletedTrial {
  participantId: string;
  trialNumber: number;
  condition: ConditionKey;
  startedAt: string;       // ISO-8601
  events: ResearchEvent[];
  csvPath: string;
}

// BLE command the app sends to start a trial
export function buildTrialStartCommand(
  participantId: string,
  condition: Condition,
): string {
  return `TRIAL:START,${participantId},${condition.key},${condition.bpm1},${condition.bpm2},${condition.syncBeats},${condition.perturbBeats},${condition.contBeats}`;
}

// Parse a raw EVT: BLE notification from firmware
// Format: EVT:{seq},{type},{beat},{firmware_timestamp_ms},{phase}
export function parseResearchEvent(raw: string, appTimestampMs: number): ResearchEvent | null {
  if (!raw.startsWith('EVT:')) return null;
  const parts = raw.slice(4).split(',');
  if (parts.length < 5) return null;
  const [seqStr, type, beatStr, tsStr, phase] = parts;
  const seq = parseInt(seqStr, 10);
  const beat = parseInt(beatStr, 10);
  const firmwareTimestampMs = parseInt(tsStr, 10);
  if (isNaN(seq) || isNaN(beat) || isNaN(firmwareTimestampMs)) return null;
  if (type !== 'CUE' && type !== 'TAP') return null;
  if (phase !== 'SYNC' && phase !== 'PERTURB' && phase !== 'CONTINUATION') return null;
  return { seq, type, beat, phase, firmwareTimestampMs, appTimestampMs, asynchronyMs: null };
}

export const CSV_HEADER =
  'participant_id,trial_number,condition,condition_name,bpm1,bpm2,' +
  'event_seq,event_type,beat_number,phase,firmware_timestamp_ms,app_timestamp_ms,asynchrony_ms\n';

export function eventToCSVRow(
  participantId: string,
  trialNumber: number,
  condition: Condition,
  event: ResearchEvent,
): string {
  return [
    participantId,
    trialNumber,
    condition.key,
    condition.name,
    condition.bpm1,
    condition.bpm2,
    event.seq,
    event.type,
    event.beat,
    event.phase,
    event.firmwareTimestampMs,
    event.appTimestampMs,
    event.asynchronyMs ?? '',
  ].join(',') + '\n';
}
