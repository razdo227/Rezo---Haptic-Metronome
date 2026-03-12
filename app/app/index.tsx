import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { bpmFromTapPoints, pushTap, type TapPoint } from '../src/lib/tempo';
import { MockTransportService } from '../src/services/transportService';
import { MidiClockTracker } from '../src/lib/midiClock';
import { applyMidiEvent, defaultSyncRuntime, shouldTimeoutBeatTrigger, type SyncMode } from '../src/lib/syncMode';
import { colors, radius, spacing, typography } from '../src/ui/theme';

const transport = new MockTransportService();

export default function HomeScreen() {
  const [bpm, setBpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [samples, setSamples] = useState<TapPoint[]>([]);
  const [mode, setMode] = useState<'manual' | 'mic'>('manual');
  const [isConnected, setIsConnected] = useState(false);
  const [midiBpm, setMidiBpm] = useState<number | null>(null);
  const [syncMode, setSyncMode] = useState<SyncMode>('INTERNAL');
  const [syncState, setSyncState] = useState(defaultSyncRuntime());
  const [vibrationType, setVibrationType] = useState<'soft' | 'pulse' | 'sharp'>('pulse');

  const derivedBpm = useMemo(() => bpmFromTapPoints(samples), [samples]);

  useEffect(() => {
    transport.connect().then(() => setIsConnected(true));
    return () => {
      transport.disconnect();
    };
  }, []);

  // placeholder MIDI path for UI/dev validation
  useEffect(() => {
    const tracker = new MidiClockTracker();
    let t = Date.now();

    const pulse = setInterval(() => {
      tracker.onClock(t);
      t += 20.833; // ~120 BPM clock pulses
      const val = tracker.getBpm();
      if (val) setMidiBpm(val);
    }, 21);

    const beat = setInterval(() => {
      if (syncMode === 'MIDI_BEAT_TRIGGER') {
        setSyncState((prev) => applyMidiEvent({ ...prev, mode: syncMode }, { type: 'beat' }, Date.now()));
      }
    }, 500);

    return () => {
      clearInterval(pulse);
      clearInterval(beat);
    };
  }, [syncMode]);

  useEffect(() => {
    const id = setInterval(() => {
      setSyncState((prev) => {
        if (shouldTimeoutBeatTrigger(prev, Date.now())) {
          return { ...prev, running: false };
        }
        return prev;
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  const onTapTempo = () => {
    const now = Date.now();
    setSamples((prev) => pushTap(prev, now));
  };

  const applyDerivedTempo = async () => {
    if (derivedBpm) {
      setBpm(derivedBpm);
      await transport.setTempo(derivedBpm);
    }
  };

  const toggleTransport = async () => {
    const next = !isRunning;
    setIsRunning(next);
    setSyncState((prev) => ({ ...prev, running: next }));
    await transport.setTransport(next ? 'running' : 'stopped');
  };

  const onTempoInput = async (v: string) => {
    const next = Math.max(20, Math.min(300, Number(v) || 120));
    setBpm(next);
    await transport.setTempo(next);
  };

  const onSyncModeChange = async (next: SyncMode) => {
    setSyncMode(next);
    setSyncState((prev) => ({ ...prev, mode: next }));
    await transport.setSyncMode(next);
  };

  const syncModeLabel: Record<SyncMode, string> = {
    INTERNAL: 'Internal',
    MIDI_CLOCK_FOLLOW: 'MIDI Clock',
    MIDI_BEAT_TRIGGER: 'Beat Trigger'
  };

  const vibrationLabel: Record<'soft' | 'pulse' | 'sharp', string> = {
    soft: 'Soft',
    pulse: 'Pulse',
    sharp: 'Sharp'
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.container}>
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <Text style={s.titleCompact}>Rezo Haptic</Text>
              <Text style={s.topMeta}>BPM {bpm} · {syncModeLabel[syncMode]}</Text>
            </View>
            <View style={[s.statusPill, isConnected ? s.statusPillOnline : s.statusPillOffline]}>
              <View style={[s.statusDot, isConnected ? s.statusDotOnline : s.statusDotOffline]} />
              <Text style={s.statusText}>{isConnected ? 'Online' : 'Linking'}</Text>
            </View>
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Transport</Text>
            </View>
            <View style={s.tempoBlock}>
              <Text style={s.label}>Tempo</Text>
              <View style={s.tempoInputWrap}>
                <TextInput value={String(bpm)} onChangeText={onTempoInput} keyboardType="number-pad" style={s.input} />
                <Text style={s.inputSuffix}>BPM</Text>
              </View>
            </View>
            <View style={s.buttonRow}>
              <Pressable style={[s.primaryButton, isRunning && s.primaryButtonActive]} onPress={toggleTransport}>
                <Text style={s.primaryButtonText}>{isRunning ? 'Stop' : 'Start'}</Text>
              </Pressable>
              <Pressable style={s.secondaryButton} onPress={onTapTempo}>
                <Text style={s.secondaryButtonText}>Tap</Text>
              </Pressable>
            </View>
            <Text style={s.label}>Vibration</Text>
            <View style={s.chipRow}>
              {(['soft', 'pulse', 'sharp'] as const).map((v) => (
                <Pressable key={v} style={[s.chip, vibrationType === v && s.chipActive]} onPress={() => setVibrationType(v)}>
                  <Text style={[s.chipText, vibrationType === v && s.chipTextActive]}>{vibrationLabel[v]}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Sync</Text>
            </View>
            <Text style={s.label}>Mode</Text>
            <View style={s.chipRow}>
              {(['INTERNAL', 'MIDI_CLOCK_FOLLOW', 'MIDI_BEAT_TRIGGER'] as SyncMode[]).map((m) => (
                <Pressable key={m} style={[s.chip, syncMode === m && s.chipActive]} onPress={() => onSyncModeChange(m)}>
                  <Text style={[s.chipText, syncMode === m && s.chipTextActive]}>{syncModeLabel[m]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.telemetryRow}>
              <View style={s.telemetryItem}>
                <Text style={s.telemetryLabel}>MIDI Clock</Text>
                <Text style={s.telemetryValue}>{midiBpm ?? '—'}</Text>
              </View>
              <View style={s.telemetryItem}>
                <Text style={s.telemetryLabel}>Beat Trigger</Text>
                <Text style={s.telemetryValue}>{syncState.running ? 'Active' : 'Idle'}</Text>
              </View>
            </View>
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Tap</Text>
            </View>
            <Text style={s.label}>Input Mode</Text>
            <View style={s.chipRow}>
              <Pressable style={[s.chip, mode === 'manual' && s.chipActive]} onPress={() => setMode('manual')}>
                <Text style={[s.chipText, mode === 'manual' && s.chipTextActive]}>Manual</Text>
              </Pressable>
              <Pressable style={[s.chip, mode === 'mic' && s.chipActive]} onPress={() => setMode('mic')}>
                <Text style={[s.chipText, mode === 'mic' && s.chipTextActive]}>Mic</Text>
              </Pressable>
            </View>
            <View style={s.telemetryStack}>
              <View style={s.telemetryLine}>
                <Text style={s.telemetryLabel}>Detected tap BPM</Text>
                <Text style={s.telemetryValue}>{derivedBpm ?? '—'}</Text>
              </View>
            </View>
            <Pressable style={s.secondaryButtonWide} onPress={applyDerivedTempo}>
              <Text style={s.secondaryButtonText}>Use BPM</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  topBar: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  topBarLeft: { flex: 1, gap: 2 },
  titleCompact: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  topMeta: { color: colors.textMuted, ...typography.bodyStrong },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1
  },
  statusPillOnline: { backgroundColor: colors.panelMuted, borderColor: colors.borderStrong },
  statusPillOffline: { backgroundColor: colors.panelMuted, borderColor: colors.border },
  statusDot: { width: 8, height: 8, borderRadius: radius.pill },
  statusDotOnline: { backgroundColor: colors.success },
  statusDotOffline: { backgroundColor: colors.textSubtle },
  statusText: { color: colors.text, ...typography.chip },
  metricsRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  metricCard: {
    minWidth: 148,
    flexGrow: 1,
    backgroundColor: colors.panelMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  metricLabel: { color: colors.textSubtle, ...typography.eyebrow },
  metricValue: { color: colors.text, ...typography.metric },
  metricValueCompact: { color: colors.text, ...typography.sectionTitle },
  sectionCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionHeader: { gap: spacing.xs },
  sectionTitle: { color: colors.text, ...typography.sectionTitle },
  sectionMeta: { color: colors.textMuted, ...typography.body },
  label: { color: colors.textSubtle, ...typography.eyebrow },
  tempoBlock: { gap: spacing.sm },
  tempoInputWrap: {
    backgroundColor: colors.panelMuted,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 0,
    ...typography.input
  },
  inputSuffix: { color: colors.textMuted, ...typography.bodyStrong },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  primaryButton: {
    minHeight: 52,
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonActive: { backgroundColor: colors.accentStrong },
  primaryButtonText: { color: colors.text, ...typography.button },
  secondaryButton: {
    minHeight: 52,
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.panelMuted,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonWide: {
    minHeight: 52,
    backgroundColor: colors.panelMuted,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: { color: colors.text, ...typography.button },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panelMuted
  },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.textMuted, ...typography.chip },
  chipTextActive: { color: colors.text },
  telemetryRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  telemetryItem: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.panelMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs
  },
  telemetryStack: { gap: spacing.sm },
  telemetryLine: {
    backgroundColor: colors.panelMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm
  },
  telemetryLabel: { color: colors.textMuted, ...typography.body },
  telemetryValue: { color: colors.text, ...typography.bodyStrong },
  foot: {
    color: colors.textSubtle,
    ...typography.body
  }
});
