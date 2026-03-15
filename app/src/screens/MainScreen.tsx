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
import { COMMANDS, SYNC_MODES, TIME_SIGNATURES } from '../constants/ble';
import { SyncMode } from '../types';
import BeatVisualizer from '../components/BeatVisualizer';
import BPMControl from '../components/BPMControl';
import PatternPicker from '../components/PatternPicker';
import TransportButton from '../components/TransportButton';

const TAP_MAX_WINDOW = 8;
const TAP_MIN_INTERVAL_MS = 200; // ~300 BPM
const TAP_MAX_INTERVAL_MS = 3000; // ~20 BPM
const TAP_RESET_TIMEOUT_MS = 3000;

// ── Battery indicator ─────────────────────────────────────────────────────────

function BatteryIndicator({ percent }: { percent: number | null }) {
  const isEmpty = percent === null;
  const isLow = percent !== null && percent < 15;
  const color = isLow ? theme.colors.error : theme.colors.textDim;
  const label = isEmpty ? '—' : `${percent}%`;

  // Build a simple text-based battery icon using filled/empty blocks
  const barCount = 4;
  const filledBars = isEmpty ? 0 : Math.round((percent! / 100) * barCount);
  const bars = Array.from({ length: barCount }, (_, i) =>
    i < filledBars ? '▮' : '▯'
  ).join('');

  return (
    <View style={batteryStyles.row}>
      <Text style={[batteryStyles.bars, { color }]}>{bars}</Text>
      <Text style={[batteryStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const batteryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bars: {
    fontSize: 11,
    letterSpacing: 0,
  },
  label: {
    fontSize: theme.fontSize.caption,
    letterSpacing: 0.5,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

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
    currentBeat,
    timeSignatureNumerator,
    batteryPercent,
  } = state;

  // Tap tempo state
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

  // Transport
  const handleTransport = useCallback(() => {
    if (isPlaying) {
      safelySend(COMMANDS.STOP);
    } else {
      safelySend(COMMANDS.START);
    }
  }, [isPlaying, safelySend]);

  // BPM change
  const handleBPMChange = useCallback(
    (newBPM: number) => {
      safelySend(COMMANDS.BPM(newBPM));
    },
    [safelySend]
  );

  // Pattern — send command AND update optimistic state
  const handlePatternSelect = useCallback(
    (patternId: string) => {
      setPatternOptimistic(patternId);
      safelySend(COMMANDS.PATTERN(patternId));
    },
    [safelySend, setPatternOptimistic]
  );

  // Mode
  const handleModeSelect = useCallback(
    (mode: string) => {
      safelySend(COMMANDS.MODE(mode));
    },
    [safelySend]
  );

  // Time signature (local only — firmware doesn't track time sig)
  const handleTimeSig = useCallback(
    (numerator: number) => {
      setTimeSignature(numerator);
    },
    [setTimeSignature]
  );

  const effectiveTimeSig = timeSignatureNumerator;

  // Tap tempo
  const handleTapTempo = useCallback(() => {
    const now = Date.now();

    // Clear reset timeout
    if (tapResetTimeoutRef.current) {
      clearTimeout(tapResetTimeoutRef.current);
    }

    const taps = tapTimestampsRef.current;

    // If last tap was too long ago, start fresh
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

    // Set reset timeout
    tapResetTimeoutRef.current = setTimeout(() => {
      tapTimestampsRef.current = [];
      setTapBPM(null);
    }, TAP_RESET_TIMEOUT_MS);
  }, [safelySend]);

  // Manual BEAT trigger (MIDI_BEAT mode)
  const handleManualBeat = useCallback(() => {
    safelySend(COMMANDS.BEAT);
  }, [safelySend]);

  // Disconnect
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>REZO</Text>
        <View style={styles.topBarRight}>
          <BatteryIndicator percent={batteryPercent} />
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: isConnected ? theme.colors.success : theme.colors.error },
            ]}
          />
          <Text style={styles.topBarDevice}>RezoHaptic</Text>
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={handleDisconnect}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.disconnectIcon}>⏏</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* BPM Control */}
        <View style={styles.section}>
          <BPMControl bpm={bpm} onBPMChange={handleBPMChange} />
        </View>

        {/* Tap Tempo */}
        <View style={styles.tapSection}>
          <TouchableOpacity
            style={styles.tapButton}
            onPress={handleTapTempo}
            activeOpacity={0.7}
          >
            <Text style={styles.tapButtonText}>TAP TEMPO</Text>
            {tapBPM !== null && (
              <Text style={styles.tapBPMPreview}>{tapBPM} BPM</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Beat visualizer + Time sig */}
        <View style={styles.section}>
          <BeatVisualizer
            totalBeats={effectiveTimeSig}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
          />
          <View style={styles.timeSigRow}>
            {TIME_SIGNATURES.map((ts) => (
              <TouchableOpacity
                key={ts.label}
                style={[
                  styles.timeSigChip,
                  effectiveTimeSig === ts.numerator && styles.timeSigChipActive,
                ]}
                onPress={() => handleTimeSig(ts.numerator)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.timeSigLabel,
                    effectiveTimeSig === ts.numerator && styles.timeSigLabelActive,
                  ]}
                >
                  {ts.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Transport button */}
        <View style={styles.transportSection}>
          <TransportButton
            isPlaying={isPlaying}
            onPress={handleTransport}
            disabled={!isConnected}
          />
        </View>

        {/* MIDI BEAT manual trigger */}
        {syncMode === 'MIDI_BEAT' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.beatTriggerButton}
              onPress={handleManualBeat}
              activeOpacity={0.7}
            >
              <Text style={styles.beatTriggerText}>BEAT</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pattern Picker */}
        <View style={styles.sectionNoH}>
          <PatternPicker
            activePattern={activePattern}
            onPatternSelect={handlePatternSelect}
          />
        </View>

        {/* Mode selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SYNC MODE</Text>
          <View style={styles.modeRow}>
            {SYNC_MODES.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modeChip,
                  syncMode === m.id && styles.modeChipActive,
                ]}
                onPress={() => handleModeSelect(m.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.modeLabel,
                    syncMode === (m.id as SyncMode) && styles.modeLabelActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  topBarTitle: {
    fontSize: theme.fontSize.h2,
    fontWeight: '200',
    color: theme.colors.text,
    letterSpacing: 6,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topBarDevice: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    letterSpacing: 1,
  },
  disconnectBtn: {
    marginLeft: theme.spacing.xs,
    padding: theme.spacing.xs,
  },
  disconnectIcon: {
    fontSize: 18,
    color: theme.colors.textDim,
  },
  section: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  sectionNoH: {
    paddingVertical: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    letterSpacing: 2,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  tapSection: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    alignItems: 'center',
  },
  tapButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    minWidth: 180,
  },
  tapButtonText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textDim,
    letterSpacing: 2,
    fontWeight: '600',
  },
  tapBPMPreview: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.accent,
    marginTop: theme.spacing.xs,
    letterSpacing: 1,
  },
  timeSigRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  timeSigChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeSigChipActive: {
    backgroundColor: theme.colors.accent + '22',
    borderColor: theme.colors.accent,
  },
  timeSigLabel: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timeSigLabelActive: {
    color: theme.colors.accent,
  },
  transportSection: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  beatTriggerButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.accentDown,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    alignItems: 'center',
  },
  beatTriggerText: {
    fontSize: theme.fontSize.h2,
    fontWeight: '700',
    color: theme.colors.accentDown,
    letterSpacing: 4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  modeChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeChipActive: {
    backgroundColor: theme.colors.accent + '22',
    borderColor: theme.colors.accent,
  },
  modeLabel: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    fontWeight: '600',
    letterSpacing: 1,
  },
  modeLabelActive: {
    color: theme.colors.accent,
  },
});
