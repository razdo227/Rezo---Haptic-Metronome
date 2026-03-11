import { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { bpmFromTapPoints, pushTap, type TapPoint } from '../src/lib/tempo';
import { MockTransportService } from '../src/services/transportService';
import { MidiClockTracker } from '../src/lib/midiClock';

const transport = new MockTransportService();

export default function HomeScreen() {
  const [bpm, setBpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [samples, setSamples] = useState<TapPoint[]>([]);
  const [mode, setMode] = useState<'manual' | 'mic'>('manual');
  const [isConnected, setIsConnected] = useState(false);
  const [midiBpm, setMidiBpm] = useState<number | null>(null);

  const derivedBpm = useMemo(() => bpmFromTapPoints(samples), [samples]);

  useEffect(() => {
    transport.connect().then(() => setIsConnected(true));
    return () => {
      transport.disconnect();
    };
  }, []);

  // placeholder MIDI clock estimator sample hook
  useEffect(() => {
    const tracker = new MidiClockTracker();
    let t = Date.now();
    // fake incoming MIDI clock pulses for UI/dev validation
    const id = setInterval(() => {
      tracker.onClock(t);
      t += 20.833; // ~120 BPM
      const val = tracker.getBpm();
      if (val) setMidiBpm(val);
    }, 21);
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
    await transport.setTransport(next ? 'running' : 'stopped');
  };

  const onTempoInput = async (v: string) => {
    const next = Math.max(20, Math.min(300, Number(v) || 120));
    setBpm(next);
    await transport.setTempo(next);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.container}>
        <Text style={s.title}>Rezo Haptic</Text>
        <Text style={s.subtitle}>Cross-platform control app (v0.1)</Text>

        <View style={s.card}>
          <Text style={s.label}>Device</Text>
          <Text style={s.meta}>{isConnected ? 'Connected (mock transport)' : 'Connecting…'}</Text>

          <Text style={s.label}>Tempo (BPM)</Text>
          <TextInput value={String(bpm)} onChangeText={onTempoInput} keyboardType="number-pad" style={s.input} />

          <View style={s.row}>
            <Pressable style={[s.btn, isRunning && s.btnActive]} onPress={toggleTransport}>
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
          <Text style={s.meta}>MIDI Clock BPM: {midiBpm ?? '—'}</Text>
          <Pressable style={s.btnGhost} onPress={applyDerivedTempo}>
            <Text style={s.btnGhostText}>Use Detected BPM</Text>
          </Pressable>
        </View>

        <Text style={s.foot}>Next: wire BLE transport + real MIDI source + mic onset capture</Text>
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
