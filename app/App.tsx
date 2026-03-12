import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from './src/ui/theme';
import { bpmFromTapPoints, pushTap, type TapPoint } from './src/lib/tempo';
import { BleTextTransportService, MockTransportService, type VibrationPattern } from './src/services/transportService';
import { MidiClockTracker } from './src/lib/midiClock';
import { applyMidiEvent, defaultSyncRuntime, shouldTimeoutBeatTrigger, type SyncMode } from './src/lib/syncMode';

const transport = Platform.OS === 'web' ? new MockTransportService() : new BleTextTransportService();

export default function App() {
  const [bpm, setBpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [samples, setSamples] = useState<TapPoint[]>([]);
  const [mode, setMode] = useState<'manual' | 'mic'>('manual');
  const [isConnected, setIsConnected] = useState(false);
  const [midiBpm, setMidiBpm] = useState<number | null>(null);
  const [syncMode, setSyncMode] = useState<SyncMode>('INTERNAL');
  const [syncState, setSyncState] = useState(defaultSyncRuntime());
  const [vibrationType, setVibrationType] = useState<VibrationPattern>('PULSE');

  const derivedBpm = useMemo(() => bpmFromTapPoints(samples), [samples]);

  useEffect(() => {
    transport.connect().then(() => setIsConnected(true)).catch(() => setIsConnected(false));
    return () => {
      transport.disconnect();
    };
  }, []);

  useEffect(() => {
    const tracker = new MidiClockTracker();
    let t = Date.now();

    const pulse = setInterval(() => {
      tracker.onClock(t);
      t += 20.833;
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

  const onPatternChange = async (next: VibrationPattern) => {
    setVibrationType(next);
    await transport.setPattern(next);
  };

  const syncModeLabel: Record<SyncMode, string> = {
    INTERNAL: 'Internal',
    MIDI_CLOCK_FOLLOW: 'MIDI Clock',
    MIDI_BEAT_TRIGGER: 'Beat Trigger'
  };

  const vibrationOptions: { key: VibrationPattern; label: string }[] = [
    { key: 'CLICK', label: 'Click' },
    { key: 'PULSE', label: 'Pulse' },
    { key: 'ACCENT', label: 'Accent' },
    { key: 'DOUBLE', label: 'Double' },
    { key: 'TRIPLET', label: 'Triplet' },
    { key: 'RAMP_UP', label: 'Ramp Up' },
    { key: 'RAMP_DOWN', label: 'Ramp Down' },
    { key: 'BUZZ_HOLD', label: 'Buzz' }
  ];

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

            <Text style={s.label}>Tempo</Text>
            <TextInput value={String(bpm)} onChangeText={onTempoInput} keyboardType="number-pad" style={s.input} />

            <View style={s.buttonRow}>
              <Pressable style={[s.primaryButton, isRunning && s.primaryButtonActive]} onPress={toggleTransport}>
                <Text style={s.primaryButtonText}>{isRunning ? 'Stop' : 'Start'}</Text>
              </Pressable>
              <Pressable style={s.secondaryButton} onPress={onTapTempo}>
                <Text style={s.secondaryButtonText}>Tap</Text>
              </Pressable>
            </View>
            <Text style={s.label}>Pattern</Text>
            <View style={s.chipRow}>
              {vibrationOptions.map((v) => (
                <Pressable key={v.key} style={[s.chip, vibrationType === v.key && s.chipActive]} onPress={() => onPatternChange(v.key)}>
                  <Text style={[s.chipText, vibrationType === v.key && s.chipTextActive]}>{v.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Sync</Text>
            </View>
            <View style={s.chipRow}>
              {(['INTERNAL', 'MIDI_CLOCK_FOLLOW', 'MIDI_BEAT_TRIGGER'] as SyncMode[]).map((m) => (
                <Pressable key={m} style={[s.chip, syncMode === m && s.chipActive]} onPress={() => onSyncModeChange(m)}>
                  <Text style={[s.chipText, syncMode === m && s.chipTextActive]}>{syncModeLabel[m]}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Tap</Text>
            </View>
            <View style={s.chipRow}>
              <Pressable style={[s.chip, mode === 'manual' && s.chipActive]} onPress={() => setMode('manual')}>
                <Text style={[s.chipText, mode === 'manual' && s.chipTextActive]}>Manual</Text>
              </Pressable>
              <Pressable style={[s.chip, mode === 'mic' && s.chipActive]} onPress={() => setMode('mic')}>
                <Text style={[s.chipText, mode === 'mic' && s.chipTextActive]}>Mic</Text>
              </Pressable>
            </View>

            <View style={s.metricsRow}>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>Detected</Text>
                <Text style={s.metricValue}>{derivedBpm ?? '—'}</Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>MIDI</Text>
                <Text style={s.metricValue}>{midiBpm ?? '—'}</Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>Beat</Text>
                <Text style={s.metricValue}>{syncState.running ? 'On' : 'Off'}</Text>
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
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1 },
  statusPillOnline: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  statusPillOffline: { backgroundColor: colors.panel, borderColor: colors.border },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotOnline: { backgroundColor: colors.success },
  statusDotOffline: { backgroundColor: colors.danger },
  statusText: { color: colors.text, ...typography.chip },
  sectionCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, ...typography.sectionTitle },
  label: { color: colors.textMuted, ...typography.eyebrow },
  input: { backgroundColor: colors.panelMuted, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.sm, color: colors.text, ...typography.input, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, backgroundColor: colors.accentStrong, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  primaryButtonActive: { backgroundColor: colors.accent },
  primaryButtonText: { color: colors.text, ...typography.button },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelMuted, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonWide: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelMuted, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.text, ...typography.button },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.textMuted, ...typography.chip },
  chipTextActive: { color: colors.text },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, backgroundColor: colors.panelMuted, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.xs },
  metricLabel: { color: colors.textSubtle, ...typography.chip },
  metricValue: { color: colors.text, ...typography.metric }
});
