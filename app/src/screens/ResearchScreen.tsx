import React, { useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, StatusBar,
} from 'react-native';
import Constants from 'expo-constants';
import { theme } from '../theme';
import { useDevice } from '../context/DeviceContext';
import { useResearch } from '../context/ResearchContext';
import { CONDITIONS, CONDITION_KEYS, ConditionKey, ResearchEvent } from '../constants/research';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAsynchrony(ms: number | null): string {
  if (ms === null) return '';
  return (ms >= 0 ? '+' : '') + ms.toFixed(0) + ' ms';
}

function phaseColor(phase: string | null): string {
  if (phase === 'SYNC') return theme.colors.accent;
  if (phase === 'PERTURB') return '#F5A623';
  if (phase === 'CONTINUATION') return theme.colors.success;
  return theme.colors.textDim;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventRow({ event, index }: { event: ResearchEvent; index: number }) {
  const isCue = event.type === 'CUE';
  return (
    <View style={[styles.eventRow, isCue ? styles.eventRowCue : styles.eventRowTap]}>
      <View style={styles.eventLeft}>
        <Text style={[styles.eventIcon, { color: isCue ? theme.colors.accent : theme.colors.success }]}>
          {isCue ? '◆' : '●'}
        </Text>
        <Text style={styles.eventType}>{event.type}</Text>
        {isCue && <Text style={styles.eventBeat}>beat {event.beat}</Text>}
      </View>
      <View style={styles.eventRight}>
        <Text style={styles.eventPhase}>{event.phase}</Text>
        {event.asynchronyMs !== null && (
          <Text style={[
            styles.eventAsync,
            { color: Math.abs(event.asynchronyMs) < 30 ? theme.colors.success : '#F5A623' },
          ]}>
            {formatAsynchrony(event.asynchronyMs)}
          </Text>
        )}
      </View>
    </View>
  );
}

function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  if (total === 0) return null;
  const pct = Math.min(current / total, 1);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ResearchScreen({ onBack }: { onBack: () => void }) {
  const { state } = useDevice();
  const {
    participantId, setParticipantId,
    selectedCondition, setSelectedCondition,
    trialNumber,
    trialStatus, currentPhase, phaseProgress,
    startTrial, stopTrial,
    liveEvents, meanAsynchronyMs,
    completedTrials, exportTrial, exportAll,
  } = useResearch();

  const scrollRef = useRef<ScrollView>(null);
  const isConnected = state.connectionState === 'connected';
  const isRunning = trialStatus === 'RUNNING';

  // Auto-scroll event log to bottom
  useEffect(() => {
    if (liveEvents.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [liveEvents.length]);

  const handleStart = async () => {
    if (!participantId.trim()) {
      Alert.alert('Missing ID', 'Enter a participant ID before starting.');
      return;
    }
    if (!isConnected) {
      Alert.alert('Not connected', 'Connect to the Rezo device first.');
      return;
    }
    try {
      await startTrial();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleStop = () => {
    Alert.alert('Stop Trial', 'End this trial early and save the collected data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop & Save', style: 'destructive', onPress: () => stopTrial() },
    ]);
  };

  const condition = CONDITIONS[selectedCondition];

  return (
    <View style={styles.root}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>RESEARCH</Text>
        <View style={[styles.connDot, { backgroundColor: isConnected ? theme.colors.success : theme.colors.error }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Participant setup ── */}
        <View style={styles.section}>
          <Text style={styles.label}>PARTICIPANT ID</Text>
          <TextInput
            style={styles.input}
            value={participantId}
            onChangeText={setParticipantId}
            placeholder="e.g. P001"
            placeholderTextColor={theme.colors.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isRunning}
          />
        </View>

        {/* ── Condition picker ── */}
        <View style={styles.section}>
          <Text style={styles.label}>CONDITION</Text>
          <View style={styles.conditionRow}>
            {CONDITION_KEYS.map(key => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.conditionBtn,
                  selectedCondition === key && styles.conditionBtnActive,
                ]}
                onPress={() => !isRunning && setSelectedCondition(key)}
                disabled={isRunning}
              >
                <Text style={[
                  styles.conditionBtnText,
                  selectedCondition === key && styles.conditionBtnTextActive,
                ]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.conditionInfo}>
            <Text style={styles.conditionName}>{condition.name}</Text>
            <Text style={styles.conditionDesc}>{condition.description}</Text>
            <Text style={styles.conditionMeta}>
              {condition.syncBeats} sync beats
              {condition.perturbBeats > 0 ? ` → ${condition.perturbBeats} perturb beats` : ''}
              {' → '}{condition.contBeats} continuation taps
            </Text>
          </View>
        </View>

        {/* ── Trial header ── */}
        <View style={styles.section}>
          <View style={styles.trialHeader}>
            <Text style={styles.trialNumber}>Trial #{trialNumber}</Text>
            {isRunning && currentPhase && (
              <View style={[styles.phasePill, { backgroundColor: phaseColor(currentPhase) + '33' }]}>
                <Text style={[styles.phaseText, { color: phaseColor(currentPhase) }]}>
                  {currentPhase}
                </Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          {isRunning && (
            <View style={styles.progressContainer}>
              <ProgressBar
                current={phaseProgress.current}
                total={phaseProgress.total}
                color={phaseColor(currentPhase)}
              />
              <Text style={styles.progressLabel}>
                {phaseProgress.current} / {phaseProgress.total}
              </Text>
            </View>
          )}

          {/* Mean asynchrony live readout */}
          {isRunning && meanAsynchronyMs !== null && (
            <View style={styles.asyncReadout}>
              <Text style={styles.asyncLabel}>Mean asynchrony</Text>
              <Text style={[
                styles.asyncValue,
                { color: Math.abs(meanAsynchronyMs) < 30 ? theme.colors.success : '#F5A623' },
              ]}>
                {formatAsynchrony(meanAsynchronyMs)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Start / Stop button ── */}
        <View style={styles.section}>
          {!isRunning ? (
            <TouchableOpacity
              style={[styles.startBtn, (!isConnected || !participantId.trim()) && styles.btnDisabled]}
              onPress={handleStart}
              disabled={!isConnected || !participantId.trim()}
            >
              <Text style={styles.startBtnText}>▶  START TRIAL {trialNumber}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>■  STOP TRIAL</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Live event log ── */}
        {liveEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>LIVE EVENTS</Text>
            <ScrollView
              ref={scrollRef}
              style={styles.eventLog}
              scrollEnabled
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {liveEvents.map((event, i) => (
                <EventRow key={`${event.seq}-${i}`} event={event} index={i} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Completed trials ── */}
        {completedTrials.length > 0 && (
          <View style={styles.section}>
            <View style={styles.completedHeader}>
              <Text style={styles.label}>COMPLETED TRIALS</Text>
              <TouchableOpacity
                style={styles.exportAllBtn}
                onPress={() => exportAll(participantId.trim())}
              >
                <Text style={styles.exportAllText}>Export all ↑</Text>
              </TouchableOpacity>
            </View>

            {completedTrials.map((trial, i) => {
              const cues = trial.events.filter(e => e.type === 'CUE').length;
              const taps = trial.events.filter(e => e.type === 'TAP').length;
              const asyncEvents = trial.events.filter(e => e.asynchronyMs !== null);
              const mean = asyncEvents.length > 0
                ? asyncEvents.reduce((s, e) => s + (e.asynchronyMs ?? 0), 0) / asyncEvents.length
                : null;
              const cond = CONDITIONS[trial.condition];
              return (
                <View key={i} style={styles.completedRow}>
                  <View style={styles.completedLeft}>
                    <Text style={styles.completedTitle}>
                      {trial.participantId} — Cond {trial.condition}
                    </Text>
                    <Text style={styles.completedMeta}>
                      {cond.name} · {cues} cues · {taps} taps
                      {mean !== null ? ` · mean async ${formatAsynchrony(mean)}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.exportBtn}
                    onPress={() => exportTrial(trial)}
                  >
                    <Text style={styles.exportBtnText}>↑</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Instructions ── */}
        {!isConnected && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠  Connect to the Rezo device from the main screen before starting a trial.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backBtn: { paddingRight: theme.spacing.md, paddingVertical: 4 },
  backIcon: { color: theme.colors.accent, fontSize: theme.fontSize.h2 },
  topBarTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    letterSpacing: 3,
  },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.md, paddingBottom: 60 },

  section: { marginBottom: theme.spacing.lg },
  label: {
    color: theme.colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
  },

  // Participant input
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.fontSize.body,
    letterSpacing: 1,
  },

  // Condition picker
  conditionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  conditionBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionBtnActive: {
    backgroundColor: theme.colors.accent + '22',
    borderColor: theme.colors.accent,
  },
  conditionBtnText: { color: theme.colors.textDim, fontSize: theme.fontSize.body, fontWeight: '600' },
  conditionBtnTextActive: { color: theme.colors.accent },
  conditionInfo: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  conditionName: { color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: '600', marginBottom: 2 },
  conditionDesc: { color: theme.colors.textDim, fontSize: theme.fontSize.caption, marginBottom: 4 },
  conditionMeta: { color: theme.colors.accent, fontSize: theme.fontSize.caption },

  // Trial header
  trialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  trialNumber: { color: theme.colors.text, fontSize: theme.fontSize.h2, fontWeight: '200', flex: 1 },
  phasePill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 100,
  },
  phaseText: { fontSize: theme.fontSize.caption, fontWeight: '700', letterSpacing: 1 },

  // Progress
  progressContainer: { marginBottom: theme.spacing.sm },
  progressTrack: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabel: { color: theme.colors.textDim, fontSize: theme.fontSize.caption, textAlign: 'right' },

  // Async readout
  asyncReadout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  asyncLabel: { color: theme.colors.textDim, fontSize: theme.fontSize.caption },
  asyncValue: { fontSize: theme.fontSize.body, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Buttons
  startBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: theme.fontSize.body, fontWeight: '700', letterSpacing: 1 },
  stopBtn: {
    backgroundColor: theme.colors.error + '22',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  stopBtnText: { color: theme.colors.error, fontSize: theme.fontSize.body, fontWeight: '700', letterSpacing: 1 },
  btnDisabled: { opacity: 0.4 },

  // Event log
  eventLog: {
    maxHeight: 260,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  eventRowCue: { backgroundColor: 'transparent' },
  eventRowTap: { backgroundColor: theme.colors.background + '88' },
  eventLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  eventIcon: { fontSize: 10 },
  eventType: { color: theme.colors.text, fontSize: theme.fontSize.caption, fontWeight: '600', width: 28 },
  eventBeat: { color: theme.colors.textDim, fontSize: theme.fontSize.caption },
  eventPhase: { color: theme.colors.textDim, fontSize: 10, letterSpacing: 0.5 },
  eventAsync: { fontSize: theme.fontSize.caption, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 60, textAlign: 'right' },

  // Completed trials
  completedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  exportAllBtn: {
    backgroundColor: theme.colors.accent + '22',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.accent + '66',
  },
  exportAllText: { color: theme.colors.accent, fontSize: theme.fontSize.caption, fontWeight: '600' },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  completedLeft: { flex: 1 },
  completedTitle: { color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: '600', marginBottom: 2 },
  completedMeta: { color: theme.colors.textDim, fontSize: theme.fontSize.caption },
  exportBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.accent + '66',
  },
  exportBtnText: { color: theme.colors.accent, fontSize: theme.fontSize.body, fontWeight: '700' },

  // Warning
  warningBanner: {
    backgroundColor: '#F5A623' + '22',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#F5A623' + '66',
  },
  warningText: { color: '#F5A623', fontSize: theme.fontSize.caption },
});
