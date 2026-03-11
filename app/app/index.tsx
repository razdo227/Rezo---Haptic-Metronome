import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

type TapSample = { at: number };

export default function HomeScreen() {
  const [bpm, setBpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [samples, setSamples] = useState<TapSample[]>([]);
  const [mode, setMode] = useState<'manual' | 'mic'>('manual');

  const derivedBpm = useMemo(() => {
    if (samples.length < 4) return null;
    const intervals: number[] = [];
    for (let i = 1; i < samples.length; i++) intervals.push(samples[i].at - samples[i - 1].at);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.max(20, Math.min(300, Math.round(60000 / avgMs)));
  }, [samples]);

  const onTapTempo = () => {
    const now = Date.now();
    setSamples(prev => {
      const fresh = prev.filter(x => now - x.at < 6000);
      return [...fresh, { at: now }].slice(-8);
    });
  };

  const applyDerivedTempo = () => {
    if (derivedBpm) setBpm(derivedBpm);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.container}>
        <Text style={s.title}>Rezo Haptic</Text>
        <Text style={s.subtitle}>Minimal control surface (v0.1)</Text>

        <View style={s.card}>
          <Text style={s.label}>Tempo (BPM)</Text>
          <TextInput
            value={String(bpm)}
            onChangeText={(v) => setBpm(Math.max(20, Math.min(300, Number(v) || 120)))}
            keyboardType="number-pad"
            style={s.input}
          />

          <View style={s.row}>
            <Pressable style={[s.btn, isRunning && s.btnActive]} onPress={() => setIsRunning(v => !v)}>
              <Text style={s.btnText}>{isRunning ? 'Stop' : 'Start'}</Text>
            </Pressable>
            <Pressable style={s.btnGhost} onPress={onTapTempo}>
              <Text style={s.btnGhostText}>Tap Tempo</Text>
            </Pressable>
          </View>

          <View style={s.row}>
            <Pressable style={[s.chip, mode === 'manual' && s.chipOn]} onPress={() => setMode('manual')}>
              <Text style={s.chipText}>Manual</Text>
            </Pressable>
            <Pressable style={[s.chip, mode === 'mic' && s.chipOn]} onPress={() => setMode('mic')}>
              <Text style={s.chipText}>Mic Tap (Sense)</Text>
            </Pressable>
          </View>

          <Text style={s.meta}>Detected Tap BPM: {derivedBpm ?? '—'}</Text>
          <Pressable style={s.btnGhost} onPress={applyDerivedTempo}>
            <Text style={s.btnGhostText}>Use Detected BPM</Text>
          </Pressable>
        </View>

        <Text style={s.foot}>Next: BLE transport + MIDI clock sync + mic onset detector</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0D10' },
  container: { flex: 1, padding: 20, gap: 14 },
  title: { color: '#F2F5F7', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#97A3AE', fontSize: 14, fontWeight: '400' },
  card: { backgroundColor: '#12161B', borderColor: '#1D242C', borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  label: { color: '#9FB0BD', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: '#0D1116', borderColor: '#1D242C', borderWidth: 1, borderRadius: 12, color: '#F2F5F7', fontSize: 24, paddingHorizontal: 14, paddingVertical: 10, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, backgroundColor: '#1A222B', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnActive: { backgroundColor: '#2A6BF2' },
  btnText: { color: 'white', fontWeight: '600' },
  btnGhost: { flex: 1, borderColor: '#2A3642', borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnGhostText: { color: '#C9D1D9', fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: '#2A3642', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: '#1F2935' },
  chipText: { color: '#C9D1D9', fontSize: 12, fontWeight: '400' },
  meta: { color: '#B8C4CE', fontSize: 13, fontWeight: '400' },
  foot: { color: '#7E8A95', fontSize: 12, fontWeight: '400' }
});
