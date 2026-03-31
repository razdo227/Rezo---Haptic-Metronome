import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { theme } from '../theme';
import { useDevice } from '../context/DeviceContext';
import { COMMANDS, PATTERNS, SYNC_MODES, TIME_SIGNATURES } from '../constants/ble';
import { SyncMode } from '../types';

const TAP_MAX_WINDOW = 8;
const TAP_MIN_INTERVAL_MS = 200; // ~300 BPM
const TAP_MAX_INTERVAL_MS = 3000; // ~20 BPM
const TAP_RESET_TIMEOUT_MS = 3000;

function BatteryIndicator({ percent }: { percent: number | null }) {
  const isEmpty = percent === null;
  const isLow = percent !== null && percent < 15;
  const color = isLow ? theme.colors.error : theme.colors.text;
  const label = isEmpty ? '—' : `${percent}%`;

  return (
    <View style={styles.batteryRow}>
      <Text style={[styles.batteryIcon, { color }]}>▮</Text>
      <Text style={[styles.batteryLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function MainScreen() {
  const {
    state,
    sendCommand,
    disconnect,
    setTimeSignature,
    setPatternOptimistic,
  } = useDevice();

  const {
    connectionState,
    isPlaying,
    bpm,
    syncMode,
    activePattern,
    timeSignatureNumerator,
    batteryPercent,
  } = state;

  const tapTimestampsRef = useRef<number[]>([]);
  const tapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapBPM, setTapBPM] = useState<number | null>(null);

  const isConnected = connectionState === 'connected';

  const safelySend = useCallback(
    async (cmd: string) => {
      try {
        await sendCommand(cmd);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Command failed';
        Alert.alert('Error', message, [{ text: 'OK' }]);
      }
    },
    [sendCommand]
  );

  const handleTransport = useCallback(() => {
    if (isPlaying) {
      safelySend(COMMANDS.STOP);
    } else {
      safelySend(COMMANDS.START);
    }
  }, [isPlaying, safelySend]);

  const handleBPMChange = useCallback(
    (newBPM: number) => {
      safelySend(COMMANDS.BPM(newBPM));
    },
    [safelySend]
  );

  const handlePatternSelect = useCallback(
    (patternId: string) => {
      setPatternOptimistic(patternId);
      safelySend(COMMANDS.PATTERN(patternId));
    },
    [safelySend, setPatternOptimistic]
  );

  const handleModeSelect = useCallback(
    (mode: string) => {
      safelySend(COMMANDS.MODE(mode));
    },
    [safelySend]
  );

  const handleTimeSig = useCallback(
    (numerator: number) => {
      setTimeSignature(numerator);
    },
    [setTimeSignature]
  );

  const handleTapTempo = useCallback(() => {
    const now = Date.now();

    if (tapResetTimeoutRef.current) {
      clearTimeout(tapResetTimeoutRef.current);
    }

    const taps = tapTimestampsRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > TAP_RESET_TIMEOUT_MS) {
      tapTimestampsRef.current = [];
    }

    tapTimestampsRef.current = [...tapTimestampsRef.current, now].slice(-TAP_MAX_WINDOW);
    const updatedTaps = tapTimestampsRef.current;

    if (updatedTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < updatedTaps.length; i++) {
        const interval = updatedTaps[i] - updatedTaps[i - 1];
        if (interval >= TAP_MIN_INTERVAL_MS && interval <= TAP_MAX_INTERVAL_MS) {
          intervals.push(interval);
        }
      }
      if (intervals.length >= 1) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBPM = Math.round(60000 / avgInterval);
        const clampedBPM = Math.max(20, Math.min(300, calculatedBPM));
        setTapBPM(clampedBPM);
        safelySend(COMMANDS.BPM(clampedBPM));
      }
    }

    tapResetTimeoutRef.current = setTimeout(() => {
      tapTimestampsRef.current = [];
      setTapBPM(null);
    }, TAP_RESET_TIMEOUT_MS);
  }, [safelySend]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect',
      'Disconnect from RezoHaptic?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnect(),
        },
      ]
    );
  }, [disconnect]);

  const adjustBpm = (delta: number) => {
    const next = Math.max(20, Math.min(300, bpm + delta));
    handleBPMChange(next);
  };

  const activePatternName = PATTERNS.find((p) => p.id === activePattern)?.displayName ?? 'Standard';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoGlyph}>◢</Text>
          </View>
          <Text style={styles.brand}>rezo</Text>
        </View>
        <View style={styles.topBarRight}>
          <BatteryIndicator percent={batteryPercent} />
          <Text style={styles.bluetooth}>ᛒ</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dialWrap}>
          <View style={styles.dialTrack}>
            <View style={styles.dialProgress} />
          </View>
          <View style={styles.dial}>
            <Text style={styles.bpmValue}>{bpm}</Text>
            <Text style={styles.bpmLabel}>BPM</Text>
          </View>
        </View>

        <View style={styles.bpmButtons}>
          <TouchableOpacity style={styles.circleButton} onPress={() => adjustBpm(-1)}>
            <Text style={styles.circleButtonText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleButton} onPress={() => adjustBpm(1)}>
            <Text style={styles.circleButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardRow}>
          <View style={styles.infoCard}>
            <Text style={styles.cardLabel}>SIGNATURE</Text>
            <Text style={styles.cardValue}>{timeSignatureNumerator}/4</Text>
            <View style={styles.chipRow}>
              {TIME_SIGNATURES.map((ts) => (
                <TouchableOpacity
                  key={ts.label}
                  style={[
                    styles.signatureChip,
                    timeSignatureNumerator === ts.numerator && styles.signatureChipActive,
                  ]}
                  onPress={() => handleTimeSig(ts.numerator)}
                >
                  <Text style={styles.signatureChipText}>{ts.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardLabel}>SUBDIVISION</Text>
            <Text style={styles.cardValue}>{activePatternName || 'Quarter'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {PATTERNS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.signatureChip, activePattern === p.id && styles.signatureChipActive]}
                    onPress={() => handlePatternSelect(p.id)}
                  >
                    <Text style={styles.signatureChipText}>{p.displayName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.cardLabel}>HAPTIC INTENSITY</Text>
            <Text style={styles.strongLabel}>{isPlaying ? 'LIVE' : 'READY'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.startButton, isPlaying && styles.stopButton]}
            onPress={handleTransport}
            disabled={!isConnected}
          >
            <Text style={styles.startText}>{isPlaying ? '■ STOP PULSE' : '▶ START PULSE'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modeWrap}>
          <Text style={styles.cardLabel}>SYNC MODE</Text>
          <View style={styles.modeRow}>
            {SYNC_MODES.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeChip, syncMode === m.id && styles.modeChipActive]}
                onPress={() => handleModeSelect(m.id)}
              >
                <Text style={[styles.modeText, syncMode === (m.id as SyncMode) && styles.modeTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.tapButton} onPress={handleTapTempo}>
          <Text style={styles.tapText}>Tap Tempo {tapBPM ? `• ${tapBPM} BPM` : ''}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
          <Text style={styles.disconnectText}>Disconnect Device</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomTabBar}>
        <Text style={[styles.tabItem, styles.tabItemActive]}>Tempo</Text>
        <Text style={styles.tabItem}>Presets</Text>
        <Text style={styles.tabItem}>Devices</Text>
        <Text style={styles.tabItem}>Settings</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    color: '#031423',
    fontSize: 12,
    fontWeight: '900',
  },
  brand: {
    color: theme.colors.accent,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryIcon: { fontSize: 13 },
  batteryLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  bluetooth: {
    color: theme.colors.textDim,
    fontSize: 28,
  },
  disconnectBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  disconnectText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  dialWrap: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    justifyContent: 'center',
  },
  dialTrack: {
    position: 'absolute',
    width: 308,
    height: 308,
    borderRadius: 154,
    borderWidth: 6,
    borderColor: '#252A33',
  },
  dialProgress: {
    position: 'absolute',
    width: 308,
    height: 308,
    borderRadius: 154,
    borderWidth: 6,
    borderColor: theme.colors.accent,
    borderBottomColor: 'transparent',
    borderLeftColor: theme.colors.accent,
    transform: [{ rotate: '-30deg' }],
  },
  dial: {
    width: 300,
    height: 300,
    borderRadius: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050A12',
  },
  bpmValue: {
    color: theme.colors.text,
    fontSize: 76,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 80,
  },
  bpmLabel: {
    color: theme.colors.textDim,
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 2,
    fontWeight: '600',
  },
  bpmButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  circleButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButtonText: {
    color: theme.colors.text,
    fontSize: 54,
    fontWeight: '300',
    marginTop: -4,
  },
  cardRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  infoCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm + 4,
    minHeight: 146,
  },
  cardLabel: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  signatureChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
  },
  signatureChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '22',
  },
  signatureChipText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  panel: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: theme.spacing.sm,
  },
  strongLabel: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  startButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 20,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: theme.colors.accentDown,
  },
  startText: {
    color: '#04101D',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  modeWrap: {
    marginTop: theme.spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
    gap: 8,
  },
  modeChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modeChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '1F',
  },
  modeText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  modeTextActive: {
    color: theme.colors.accent,
  },
  tapButton: {
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  tapText: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomTabBar: {
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: '#04060B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  tabItem: {
    color: theme.colors.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  tabItemActive: {
    color: theme.colors.accent,
  },
});
