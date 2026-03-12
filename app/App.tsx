import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from './src/ui/theme';
import { bpmFromTapPoints, pushTap, type TapPoint } from './src/lib/tempo';
import { type VibrationPattern, RezoTransportService, pairing } from './src/services/transportService';
import type { SyncMode } from './src/lib/syncMode';

const transport = new RezoTransportService();

export default function App() {
  const [paired, setPaired] = useState(false);
  const [pairingStatus, setPairingStatus] = useState('Not paired');
  const [devices, setDevices] = useState<Array<{ id: string; name: string }>>([]);

  const [bpm, setBpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [samples, setSamples] = useState<TapPoint[]>([]);
  const [syncMode, setSyncMode] = useState<SyncMode>('INTERNAL');
  const [pattern, setPattern] = useState<VibrationPattern>('PULSE');

  const derivedBpm = useMemo(() => bpmFromTapPoints(samples), [samples]);

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

  const scan = async () => {
    setPairingStatus('Scanning...');
    const found = await pairing.scanDevices(7000);
    setDevices(found);
    setPairingStatus(found.length ? 'Select a device' : 'No devices found');
  };

  const connect = async (id: string, name: string) => {
    setPairingStatus('Connecting...');
    const ok = await pairing.connect(id);
    if (ok) {
      setPaired(true);
      setPairingStatus(`Paired: ${name}`);
    } else {
      setPairingStatus('Connect failed');
    }
  };

  const onTempoInput = async (v: string) => {
    const next = Math.max(20, Math.min(300, Number(v) || 120));
    setBpm(next);
    await transport.setTempo(next);
  };

  const toggleTransport = async () => {
    const next = !isRunning;
    setIsRunning(next);
    await transport.setTransport(next ? 'running' : 'stopped');
  };

  const setMode = async (m: SyncMode) => {
    setSyncMode(m);
    await transport.setSyncMode(m);
  };

  const setPatternCmd = async (p: VibrationPattern) => {
    setPattern(p);
    await transport.setPattern(p);
  };

  const tap = () => setSamples((prev) => pushTap(prev, Date.now()));

  if (!paired) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.container}>
          <Text style={s.title}>Pair Device</Text>
          <Text style={s.meta}>{pairingStatus}</Text>
          <Pressable style={s.primaryButton} onPress={scan}>
            <Text style={s.primaryButtonText}>Scan</Text>
          </Pressable>

          <View style={{ gap: spacing.sm }}>
            {devices.map((d) => (
              <Pressable key={d.id} style={s.deviceRow} onPress={() => connect(d.id, d.name)}>
                <Text style={s.deviceText}>{d.name}</Text>
                <Text style={s.deviceMeta}>Pair</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.container}>
          <View style={s.topBar}>
            <Text style={s.title}>Rezo Haptic</Text>
            <Text style={s.meta}>{pairingStatus}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Tempo</Text>
            <TextInput style={s.input} keyboardType="number-pad" value={String(bpm)} onChangeText={onTempoInput} />
            <View style={s.row}>
              <Pressable style={s.primaryButton} onPress={toggleTransport}><Text style={s.primaryButtonText}>{isRunning ? 'Stop' : 'Start'}</Text></Pressable>
              <Pressable style={s.secondaryButton} onPress={tap}><Text style={s.secondaryButtonText}>Tap</Text></Pressable>
            </View>
            <Text style={s.meta}>Tap BPM: {derivedBpm ?? '—'}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Sync</Text>
            <View style={s.chipRow}>
              {(['INTERNAL', 'MIDI_CLOCK_FOLLOW', 'MIDI_BEAT_TRIGGER'] as SyncMode[]).map((m) => (
                <Pressable key={m} style={[s.chip, syncMode === m && s.chipOn]} onPress={() => setMode(m)}>
                  <Text style={s.chipText}>{syncModeLabel[m]}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Pattern</Text>
            <View style={s.chipRow}>
              {vibrationOptions.map((v) => (
                <Pressable key={v.key} style={[s.chip, pattern === v.key && s.chipOn]} onPress={() => setPatternCmd(v.key)}>
                  <Text style={s.chipText}>{v.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  container: { padding: spacing.lg, gap: spacing.lg },
  topBar: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundElevated, gap: spacing.xs },
  title: { color: colors.text, ...typography.sectionTitle },
  meta: { color: colors.textMuted, ...typography.body },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, gap: spacing.sm },
  label: { color: colors.textMuted, ...typography.eyebrow },
  input: { backgroundColor: colors.panelMuted, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.sm, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.input },
  row: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, backgroundColor: colors.accentStrong, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  primaryButtonText: { color: colors.text, ...typography.button },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelMuted, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  secondaryButtonText: { color: colors.text, ...typography.button },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { color: colors.text, ...typography.chip },
  deviceRow: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, padding: spacing.md, backgroundColor: colors.panel, flexDirection: 'row', justifyContent: 'space-between' },
  deviceText: { color: colors.text, ...typography.bodyStrong },
  deviceMeta: { color: colors.accent, ...typography.bodyStrong }
});
