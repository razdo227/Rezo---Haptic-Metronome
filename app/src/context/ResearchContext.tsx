import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { Share } from 'react-native';
import bleService from '../services/BLEService';
import {
  ConditionKey, Condition, CompletedTrial, ResearchEvent, TrialPhase, TrialStatus,
  CONDITIONS, CONDITION_KEYS,
  parseResearchEvent, buildTrialStartCommand,
  CSV_HEADER, eventToCSVRow,
} from '../constants/research';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResearchContextValue {
  // Setup
  participantId: string;
  setParticipantId: (id: string) => void;
  selectedCondition: ConditionKey;
  setSelectedCondition: (key: ConditionKey) => void;
  trialNumber: number;

  // Trial control
  trialStatus: TrialStatus;
  currentPhase: TrialPhase | null;
  phaseProgress: { current: number; total: number };
  startTrial: () => Promise<void>;
  stopTrial: () => Promise<void>;

  // Live events
  liveEvents: ResearchEvent[];
  meanAsynchronyMs: number | null;

  // Completed
  completedTrials: CompletedTrial[];
  exportTrial: (trial: CompletedTrial) => Promise<void>;
  exportAll: (participantId: string) => Promise<void>;
}

const ResearchContext = createContext<ResearchContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ResearchProvider({ children }: { children: React.ReactNode }) {
  const [participantId, setParticipantId] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<ConditionKey>(CONDITION_KEYS[0]);
  const [trialNumber, setTrialNumber] = useState(1);
  const [trialStatus, setTrialStatus] = useState<TrialStatus>('IDLE');
  const [currentPhase, setCurrentPhase] = useState<TrialPhase | null>(null);
  const [liveEvents, setLiveEvents] = useState<ResearchEvent[]>([]);
  const [completedTrials, setCompletedTrials] = useState<CompletedTrial[]>([]);

  // Mutable refs used inside BLE callback (avoids stale closures)
  const trialRef = useRef<{
    participantId: string;
    trialNumber: number;
    condition: Condition;
    startedAt: string;
    events: ResearchEvent[];
    cueCount: number;
    lastCueTimestamp: number | null;
  } | null>(null);

  // ── Phase computation ──────────────────────────────────────────────────────
  // Since the firmware sends phase tags in EVT messages, we use those directly.
  // As a fallback, we also track locally by CUE count.
  const computePhase = useCallback((cueCount: number, condition: Condition): TrialPhase => {
    if (cueCount <= condition.syncBeats) return 'SYNC';
    if (cueCount <= condition.syncBeats + condition.perturbBeats) return 'PERTURB';
    return 'CONTINUATION';
  }, []);

  const phaseProgress = (() => {
    if (!trialRef.current || !currentPhase) return { current: 0, total: 0 };
    const c = trialRef.current.condition;
    const cueCount = trialRef.current.cueCount;
    if (currentPhase === 'SYNC') return { current: cueCount, total: c.syncBeats };
    if (currentPhase === 'PERTURB') return { current: cueCount - c.syncBeats, total: c.perturbBeats };
    const tapCount = trialRef.current.events.filter(e => e.type === 'TAP' && e.phase === 'CONTINUATION').length;
    return { current: tapCount, total: c.contBeats };
  })();

  const meanAsynchronyMs = (() => {
    const asyncEvents = liveEvents.filter(e => e.asynchronyMs !== null);
    if (asyncEvents.length === 0) return null;
    return asyncEvents.reduce((sum, e) => sum + (e.asynchronyMs ?? 0), 0) / asyncEvents.length;
  })();

  // ── BLE event handler ──────────────────────────────────────────────────────
  useEffect(() => {
    bleService.onResearchEvent = (raw: string) => {
      const now = Date.now();
      const event = parseResearchEvent(raw, now);
      if (!event || !trialRef.current) return;

      const t = trialRef.current;

      // Compute asynchrony for TAP events
      if (event.type === 'TAP' && t.lastCueTimestamp !== null) {
        event.asynchronyMs = event.appTimestampMs - t.lastCueTimestamp;
      }

      // Track last CUE timestamp for asynchrony calculation
      if (event.type === 'CUE') {
        t.cueCount += 1;
        t.lastCueTimestamp = event.appTimestampMs;
        const phase = computePhase(t.cueCount, t.condition);
        setCurrentPhase(phase);
      }

      t.events.push(event);
      setLiveEvents(prev => [...prev, event]);

      // Auto-complete: if we've received all continuation taps
      const contTaps = t.events.filter(e => e.type === 'TAP' && e.phase === 'CONTINUATION').length;
      if (currentPhase === 'CONTINUATION' && contTaps >= t.condition.contBeats) {
        finalizeTrial();
      }
    };

    return () => {
      bleService.onResearchEvent = null;
    };
  }, [computePhase, currentPhase]);

  // ── CSV persistence ────────────────────────────────────────────────────────
  const researchDir = FileSystem.documentDirectory + 'rezo_research/';

  const ensureDir = useCallback(async () => {
    const info = await FileSystem.getInfoAsync(researchDir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(researchDir, { intermediates: true });
  }, [researchDir]);

  const csvPath = useCallback((pid: string) => `${researchDir}${pid}.csv`, [researchDir]);

  const writeTrialToCSV = useCallback(async (trial: CompletedTrial) => {
    await ensureDir();
    const path = csvPath(trial.participantId);
    const info = await FileSystem.getInfoAsync(path);
    const condition = CONDITIONS[trial.condition];

    let rows = '';
    for (const event of trial.events) {
      rows += eventToCSVRow(trial.participantId, trial.trialNumber, condition, event);
    }

    if (!info.exists) {
      await FileSystem.writeAsStringAsync(path, CSV_HEADER + rows, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      const existing = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await FileSystem.writeAsStringAsync(path, existing + rows, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
  }, [ensureDir, csvPath]);

  // ── Trial lifecycle ────────────────────────────────────────────────────────
  const startTrial = useCallback(async () => {
    if (!participantId.trim()) throw new Error('Participant ID is required');

    const condition = CONDITIONS[selectedCondition];
    const startedAt = new Date().toISOString();

    trialRef.current = {
      participantId: participantId.trim(),
      trialNumber,
      condition,
      startedAt,
      events: [],
      cueCount: 0,
      lastCueTimestamp: null,
    };

    setLiveEvents([]);
    setCurrentPhase('SYNC');
    setTrialStatus('RUNNING');

    await bleService.sendCommand(buildTrialStartCommand(participantId.trim(), condition));
  }, [participantId, selectedCondition, trialNumber]);

  const finalizeTrial = useCallback(async () => {
    if (!trialRef.current) return;
    const t = trialRef.current;
    const path = csvPath(t.participantId);

    const completed: CompletedTrial = {
      participantId: t.participantId,
      trialNumber: t.trialNumber,
      condition: t.condition.key,
      startedAt: t.startedAt,
      events: [...t.events],
      csvPath: path,
    };

    await writeTrialToCSV(completed);
    setCompletedTrials(prev => [...prev, completed]);
    setTrialNumber(n => n + 1);
    setTrialStatus('DONE');
    setCurrentPhase(null);
    trialRef.current = null;
  }, [csvPath, writeTrialToCSV]);

  const stopTrial = useCallback(async () => {
    await bleService.sendCommand('TRIAL:STOP');
    await finalizeTrial();
  }, [finalizeTrial]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportTrial = useCallback(async (trial: CompletedTrial) => {
    const condition = CONDITIONS[trial.condition];
    let csv = CSV_HEADER;
    for (const event of trial.events) {
      csv += eventToCSVRow(trial.participantId, trial.trialNumber, condition, event);
    }
    await Share.share({
      title: `Rezo_${trial.participantId}_Trial${trial.trialNumber}`,
      message: csv,
    });
  }, []);

  const exportAll = useCallback(async (pid: string) => {
    await ensureDir();
    const path = csvPath(pid);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return;
    const content = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Share.share({
      title: `Rezo_${pid}_AllTrials`,
      message: content,
    });
  }, [ensureDir, csvPath]);

  return (
    <ResearchContext.Provider value={{
      participantId, setParticipantId,
      selectedCondition, setSelectedCondition,
      trialNumber,
      trialStatus, currentPhase, phaseProgress,
      startTrial, stopTrial,
      liveEvents, meanAsynchronyMs,
      completedTrials, exportTrial, exportAll,
    }}>
      {children}
    </ResearchContext.Provider>
  );
}

export function useResearch(): ResearchContextValue {
  const ctx = useContext(ResearchContext);
  if (!ctx) throw new Error('useResearch must be used within ResearchProvider');
  return ctx;
}
