import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useDevice } from '../context/DeviceContext';
import { COMMANDS, PATTERNS, TIME_SIGNATURES } from '../constants/ble';
import { PatternId } from '../types';

const TAP_MAX_WINDOW = 8;
const TAP_MIN_INTERVAL_MS = 200; // ~300 BPM
const TAP_MAX_INTERVAL_MS = 3000; // ~20 BPM
const TAP_RESET_TIMEOUT_MS = 3000;

const TAB_ITEMS = [
  { id: 'tempo', label: 'Tempo', icon: 'speedometer-outline' },
  { id: 'presets', label: 'Presets', icon: 'albums-outline' },
  { id: 'devices', label: 'Devices', icon: 'bluetooth-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
] as const;

function getPatternChipLabel(patternId: PatternId) {
  switch (patternId) {
    case 'BUZZ_HOLD':
      return 'Buzz';
    case 'RAMP_UP':
      return 'Ramp+';
    case 'RAMP_DOWN':
      return 'Ramp-';
    default:
      return PATTERNS.find((pattern) => pattern.id === patternId)?.displayName ?? patternId;
  }
}

type SelectorSheet = 'time-signature' | 'pulse' | null;

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
  const { height } = useWindowDimensions();
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
    activePattern,
    timeSignatureNumerator,
    batteryPercent,
  } = state;

  const tapTimestampsRef = useRef<number[]>([]);
  const tapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapBPM, setTapBPM] = useState<number | null>(null);
  const [openSheet, setOpenSheet] = useState<SelectorSheet>(null);

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
    (patternId: PatternId) => {
      setPatternOptimistic(patternId);
      safelySend(COMMANDS.PATTERN(patternId));
    },
    [safelySend, setPatternOptimistic]
  );

  const handleTimeSig = useCallback(
    (numerator: number) => {
      setTimeSignature(numerator);
      safelySend(COMMANDS.TS(numerator));
    },
    [safelySend, setTimeSignature]
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

  const activePatternInfo = PATTERNS.find((p) => p.id === activePattern) ?? PATTERNS[0];
  const activeTimeSignature = TIME_SIGNATURES.find((signature) => signature.numerator === timeSignatureNumerator)
    ?? TIME_SIGNATURES[0];
  const compactLayout = height < 860;
  const dialSize = compactLayout ? 192 : 220;
  const dialRingSize = dialSize + (compactLayout ? 10 : 14);
  const sideButtonSize = compactLayout ? 74 : 82;
  const selectorTitle = openSheet === 'pulse' ? 'Select Pulse' : 'Select Time Signature';
  const selectorOptions = openSheet === 'pulse'
    ? PATTERNS.map((pattern) => ({
        key: pattern.id,
        label: pattern.displayName,
        meta: pattern.description,
        selected: activePattern === pattern.id,
        onPress: () => {
          setOpenSheet(null);
          handlePatternSelect(pattern.id);
        },
      }))
    : TIME_SIGNATURES.map((signature) => ({
        key: signature.label,
        label: signature.label,
        meta: `${signature.numerator} beats per bar`,
        selected: timeSignatureNumerator === signature.numerator,
        onPress: () => {
          setOpenSheet(null);
          handleTimeSig(signature.numerator);
        },
      }));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.topBar, compactLayout && styles.topBarCompact]}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoGlyph}>◢</Text>
          </View>
          <Text style={styles.brand}>rezo</Text>
        </View>
        <View style={styles.topBarRight}>
          <BatteryIndicator percent={batteryPercent} />
          <View style={styles.connectionBadge}>
            <Ionicons name="bluetooth-outline" size={18} color={theme.colors.textDim} />
          </View>
          <TouchableOpacity style={styles.disconnectIconBtn} onPress={handleDisconnect}>
            <Ionicons name="power-outline" size={17} color={theme.colors.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.content, compactLayout && styles.contentCompact]}>
        <View style={styles.tempoSection}>
          <TouchableOpacity
            style={[
              styles.sideControl,
              compactLayout && styles.sideControlCompact,
              { width: sideButtonSize, height: sideButtonSize, borderRadius: sideButtonSize / 2 },
            ]}
            onPress={() => adjustBpm(-1)}
          >
            <Text style={[styles.sideControlText, compactLayout && styles.sideControlTextCompact]}>−</Text>
          </TouchableOpacity>

          <View style={[styles.dialWrap, { width: dialRingSize, height: dialRingSize }]}>
            <View
              style={[
                styles.dialTrack,
                {
                  width: dialRingSize,
                  height: dialRingSize,
                  borderRadius: dialRingSize / 2,
                  borderWidth: compactLayout ? 4 : 6,
                },
              ]}
            />
            <View
              style={[
                styles.dialProgress,
                {
                  width: dialRingSize,
                  height: dialRingSize,
                  borderRadius: dialRingSize / 2,
                  borderWidth: compactLayout ? 4 : 6,
                },
              ]}
            />
            <View
              style={[
                styles.dial,
                {
                  width: dialSize,
                  height: dialSize,
                  borderRadius: dialSize / 2,
                },
              ]}
            >
              <Text style={[styles.bpmValue, compactLayout && styles.bpmValueCompact]}>{bpm}</Text>
              <Text style={[styles.bpmLabel, compactLayout && styles.bpmLabelCompact]}>BPM</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.sideControl,
              compactLayout && styles.sideControlCompact,
              { width: sideButtonSize, height: sideButtonSize, borderRadius: sideButtonSize / 2 },
            ]}
            onPress={() => adjustBpm(1)}
          >
            <Text style={[styles.sideControlText, compactLayout && styles.sideControlTextCompact]}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardRow}>
          <View style={[styles.controlCard, styles.splitCard]}>
            <View style={styles.controlSectionHeader}>
              <Text style={styles.cardLabel}>TIME SIGNATURE</Text>
            </View>
            <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setOpenSheet('time-signature')}>
              <Text style={styles.dropdownValue}>{activeTimeSignature.label}</Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.textDim} />
            </TouchableOpacity>
          </View>

          <View style={[styles.controlCard, styles.splitCard]}>
            <View style={styles.controlSectionHeader}>
              <Text style={styles.cardLabel}>PULSE</Text>
            </View>
            <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setOpenSheet('pulse')}>
              <View style={styles.dropdownValueStack}>
                <Text style={styles.dropdownValue}>{getPatternChipLabel(activePatternInfo.id)}</Text>
                <Text style={styles.dropdownMeta}>{activePatternInfo.description}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={theme.colors.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.cardLabel}>TRANSPORT</Text>
            <Text style={styles.strongLabel}>{isPlaying ? 'LIVE' : 'READY'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.startButton, compactLayout && styles.startButtonCompact, isPlaying && styles.stopButton]}
            onPress={handleTransport}
            disabled={!isConnected}
          >
            <Text style={styles.startText}>{isPlaying ? '■ STOP PULSE' : '▶ START PULSE'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.tapButton} onPress={handleTapTempo}>
          <Text style={styles.tapText}>Tap Tempo {tapBPM ? `• ${tapBPM} BPM` : ''}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={openSheet !== null}
        onRequestClose={() => setOpenSheet(null)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpenSheet(null)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectorTitle}</Text>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setOpenSheet(null)}>
                <Ionicons name="close" size={18} color={theme.colors.textDim} />
              </TouchableOpacity>
            </View>
            <View style={styles.sheetList}>
              {selectorOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.sheetOption, option.selected && styles.sheetOptionSelected]}
                  onPress={option.onPress}
                >
                  <View>
                    <Text style={[styles.sheetOptionLabel, option.selected && styles.sheetOptionLabelSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.sheetOptionMeta}>{option.meta}</Text>
                  </View>
                  {option.selected ? (
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.accent} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={18} color={theme.colors.border} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomTabBar}>
        {TAB_ITEMS.map((tab) => {
          const isActive = tab.id === 'tempo';

          return (
            <View key={tab.id} style={styles.tabButton}>
              <Ionicons
                name={tab.icon}
                size={18}
                color={isActive ? theme.colors.accent : theme.colors.textDim}
              />
              <Text style={[styles.tabItem, isActive && styles.tabItemActive]}>{tab.label}</Text>
            </View>
          );
        })}
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  contentCompact: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
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
  topBarCompact: {
    paddingVertical: theme.spacing.sm,
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
    gap: 6,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryIcon: { fontSize: 13 },
  batteryLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  connectionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  disconnectIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  tempoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  dialWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialTrack: {
    position: 'absolute',
    borderColor: '#252A33',
  },
  dialProgress: {
    position: 'absolute',
    borderColor: theme.colors.accent,
    borderBottomColor: 'transparent',
    borderLeftColor: theme.colors.accent,
    transform: [{ rotate: '-30deg' }],
  },
  dial: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050A12',
  },
  bpmValue: {
    color: theme.colors.text,
    fontSize: 60,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 64,
  },
  bpmValueCompact: {
    fontSize: 52,
    lineHeight: 56,
  },
  bpmLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 2,
    fontWeight: '600',
  },
  bpmLabelCompact: {
    fontSize: 11,
    letterSpacing: 1.5,
  },
  sideControl: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideControlCompact: {
    borderWidth: 1,
  },
  sideControlText: {
    color: theme.colors.text,
    fontSize: 42,
    fontWeight: '300',
    marginTop: -4,
  },
  sideControlTextCompact: {
    fontSize: 36,
  },
  controlCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  splitCard: {
    flex: 1,
  },
  controlSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLabel: {
    color: theme.colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownValueStack: {
    flex: 1,
  },
  dropdownValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownMeta: {
    color: theme.colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  strongLabel: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  startButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonCompact: {
    minHeight: 60,
  },
  stopButton: {
    backgroundColor: theme.colors.accentDown,
  },
  startText: {
    color: '#04101D',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  tapButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: '#05070DBB',
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
  },
  sheetCard: {
    backgroundColor: '#0B1018',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  sheetList: {
    gap: 8,
  },
  sheetOption: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sheetOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + '14',
  },
  sheetOptionLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetOptionLabelSelected: {
    color: theme.colors.accent,
  },
  sheetOptionMeta: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 3,
  },
  tapText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomTabBar: {
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: '#04060B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 64,
  },
  tabItem: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  tabItemActive: {
    color: theme.colors.accent,
  },
});
