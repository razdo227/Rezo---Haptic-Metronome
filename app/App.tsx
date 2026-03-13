import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from './src/ui/theme';
import { type VibrationPattern, RezoTransportService, pairing } from './src/services/transportService';
import { syncModeLabel, type SyncMode } from './src/lib/syncMode';

const transport = new RezoTransportService();
type PairingStage = 'launch' | 'scan' | 'confirm' | 'control';
type DeviceSummary = { id: string; name: string };

export default function App() {
  const [stage, setStage] = useState<PairingStage>('launch');
  const [pairingStatus, setPairingStatus] = useState('Ready to scan');
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>('INTERNAL');
  const [pattern, setPattern] = useState<VibrationPattern>('PULSE');

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

  useEffect(() => {
    return () => {
      void pairing.destroy();
    };
  }, []);

  const scan = async () => {
    setBusy(true);
    setStage('scan');
    setSelectedDevice(null);
    setPairingStatus('Scanning for Rezo devices...');
    try {
      const found = await pairing.scanDevices(7000);
      setDevices(found);
      setPairingStatus(found.length ? 'Select one device to pair' : 'No compatible devices found');
    } catch (error) {
      setDevices([]);
      setPairingStatus(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const connect = async (device: DeviceSummary) => {
    setBusy(true);
    setPairingStatus(`Pairing with ${device.name}...`);
    const ok = await pairing.connect(device.id);
    if (ok) {
      setSelectedDevice(device);
      setPairingStatus(`Pairing complete: ${device.name}`);
      setStage('confirm');
    } else {
      setPairingStatus(`Pairing failed: ${device.name}`);
    }
    setBusy(false);
  };

  const confirmPairing = () => {
    setStage('control');
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

  if (stage === 'launch' || stage === 'scan') {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.container}>
          <Text style={s.kicker}>Mobile Controller</Text>
          <Text style={s.heroTitle}>Pair your Rezo device first.</Text>
          <Text style={s.meta}>{pairingStatus}</Text>
          <Pressable style={[s.primaryButton, busy && s.buttonDisabled]} disabled={busy} onPress={scan}>
            <Text style={s.primaryButtonText}>{busy ? 'Scanning…' : 'Scan for devices'}</Text>
          </Pressable>

          <View style={s.deviceList}>
            {devices.map((d) => (
              <Pressable key={d.id} style={[s.deviceRow, busy && s.buttonDisabled]} disabled={busy} onPress={() => connect(d)}>
                <View style={s.deviceCopy}>
                  <Text style={s.deviceText}>{d.name}</Text>
                  <Text style={s.deviceSubtext}>{d.id}</Text>
                </View>
                <Text style={s.deviceMeta}>Pair</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'confirm' && selectedDevice) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.container}>
          <View style={s.confirmCard}>
            <Text style={s.kicker}>Pairing Complete</Text>
            <Text style={s.heroTitle}>Connected to {selectedDevice.name}.</Text>
            <Text style={s.meta}>Confirm the pairing and continue to controls.</Text>
            <Pressable style={s.primaryButton} onPress={confirmPairing}>
              <Text style={s.primaryButtonText}>Continue to controls</Text>
            </Pressable>
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
            <Text style={s.meta}>{selectedDevice ? `Paired: ${selectedDevice.name}` : pairingStatus}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Tempo</Text>
            <TextInput style={s.input} keyboardType="number-pad" value={String(bpm)} onChangeText={onTempoInput} />
            <Pressable style={s.primaryButton} onPress={toggleTransport}><Text style={s.primaryButtonText}>{isRunning ? 'Stop' : 'Start'}</Text></Pressable>
          </View>

          <View style={s.card}>
            <Text style={s.label}>Sync</Text>
            <View style={s.chipRow}>
              {(['INTERNAL', 'BLE_MIDI'] as SyncMode[]).map((m) => (
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
  kicker: { color: colors.accent, ...typography.eyebrow },
  heroTitle: { color: colors.text, ...typography.title },
  topBar: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundElevated, gap: spacing.xs },
  title: { color: colors.text, ...typography.sectionTitle },
  meta: { color: colors.textMuted, ...typography.body },
  card: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, gap: spacing.sm },
  confirmCard: { padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panel, gap: spacing.md },
  label: { color: colors.textMuted, ...typography.eyebrow },
  input: { backgroundColor: colors.panelMuted, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.sm, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.input },
  row: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, backgroundColor: colors.accentStrong, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.text, ...typography.button },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelMuted, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
  secondaryButtonText: { color: colors.text, ...typography.button },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { color: colors.text, ...typography.chip },
  deviceList: { gap: spacing.sm },
  deviceRow: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, padding: spacing.md, backgroundColor: colors.panel, flexDirection: 'row', justifyContent: 'space-between' },
  deviceCopy: { flex: 1, gap: spacing.xs, paddingRight: spacing.md },
  deviceText: { color: colors.text, ...typography.bodyStrong },
  deviceSubtext: { color: colors.textSubtle, ...typography.chip },
  deviceMeta: { color: colors.accent, ...typography.bodyStrong }
});
