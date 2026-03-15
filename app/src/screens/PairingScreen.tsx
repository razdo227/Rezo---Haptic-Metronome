import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import { theme } from '../theme';
import { useDevice } from '../context/DeviceContext';
import { ConnectionState, FoundDevice } from '../types';

// ── Scan animation ────────────────────────────────────────────────────────────

function ScanAnimation({ active }: { active: boolean }) {
  const scaleOuter = useRef(new Animated.Value(1)).current;
  const opacityOuter = useRef(new Animated.Value(0)).current;
  const scaleInner = useRef(new Animated.Value(1)).current;
  const opacityInner = useRef(new Animated.Value(0)).current;
  const animLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      animLoopRef.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.parallel([
              Animated.timing(scaleOuter, { toValue: 2.2, duration: 1200, useNativeDriver: true }),
              Animated.timing(opacityOuter, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(scaleOuter, { toValue: 1, duration: 0, useNativeDriver: true }),
              Animated.timing(opacityOuter, { toValue: 0.35, duration: 0, useNativeDriver: true }),
            ]),
          ]),
          Animated.sequence([
            Animated.delay(400),
            Animated.parallel([
              Animated.timing(scaleInner, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
              Animated.timing(opacityInner, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(scaleInner, { toValue: 1, duration: 0, useNativeDriver: true }),
              Animated.timing(opacityInner, { toValue: 0.5, duration: 0, useNativeDriver: true }),
            ]),
          ]),
        ])
      );
      opacityOuter.setValue(0.35);
      opacityInner.setValue(0.5);
      animLoopRef.current.start();
    } else {
      animLoopRef.current?.stop();
      Animated.parallel([
        Animated.timing(scaleOuter, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacityOuter, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleInner, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacityInner, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    return () => {
      animLoopRef.current?.stop();
    };
  }, [active, scaleOuter, opacityOuter, scaleInner, opacityInner]);

  return (
    <View style={scanStyles.wrapper}>
      {/* Outer ring */}
      <Animated.View
        style={[
          scanStyles.ring,
          {
            width: 160,
            height: 160,
            borderRadius: 80,
            opacity: opacityOuter,
            transform: [{ scale: scaleOuter }],
          },
        ]}
      />
      {/* Inner ring */}
      <Animated.View
        style={[
          scanStyles.ring,
          {
            width: 120,
            height: 120,
            borderRadius: 60,
            opacity: opacityInner,
            transform: [{ scale: scaleInner }],
          },
        ]}
      />
      {/* Core dot */}
      <View style={scanStyles.core} />
    </View>
  );
}

const scanStyles = StyleSheet.create({
  wrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  core: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
  },
});

// ── RSSI signal bars ──────────────────────────────────────────────────────────

function SignalBars({ rssi }: { rssi: number }) {
  // Strong: > -60, Medium: > -80, Weak: <= -80
  const strength = rssi > -60 ? 3 : rssi > -80 ? 2 : 1;
  return (
    <View style={signalStyles.row}>
      {[1, 2, 3].map((level) => (
        <View
          key={level}
          style={[
            signalStyles.bar,
            { height: 6 + level * 4 },
            level <= strength ? signalStyles.barActive : signalStyles.barInactive,
          ]}
        />
      ))}
    </View>
  );
}

const signalStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 5,
    borderRadius: 2,
  },
  barActive: {
    backgroundColor: theme.colors.accent,
  },
  barInactive: {
    backgroundColor: theme.colors.border,
  },
});

// ── Status helpers ────────────────────────────────────────────────────────────

function statusLabel(state: ConnectionState): string {
  switch (state) {
    case 'scanning':   return 'Scanning...';
    case 'connecting': return 'Connecting...';
    case 'connected':  return 'Connected';
    default:           return 'Not connected';
  }
}

function statusColor(state: ConnectionState): string {
  switch (state) {
    case 'connected':  return theme.colors.success;
    case 'scanning':
    case 'connecting': return theme.colors.accent;
    default:           return theme.colors.textDim;
  }
}

// ── Device row ────────────────────────────────────────────────────────────────

function DeviceRow({
  device,
  onPress,
  disabled,
}: {
  device: FoundDevice;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      style={deviceRowStyles.row}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled}
    >
      <View style={deviceRowStyles.left}>
        <Text style={deviceRowStyles.name}>{device.name}</Text>
        <Text style={deviceRowStyles.id}>{device.id.slice(0, 8).toUpperCase()}</Text>
      </View>
      <SignalBars rssi={device.rssi} />
    </TouchableOpacity>
  );
}

const deviceRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    marginBottom: theme.spacing.sm,
  },
  left: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  name: {
    fontSize: theme.fontSize.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  id: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    letterSpacing: 1,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PairingScreen() {
  const { state, startScan, stopScan, connectToDevice } = useDevice();
  const { connectionState, foundDevices } = state;

  const isScanning = connectionState === 'scanning';
  const isConnecting = connectionState === 'connecting';
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);

  // Reset connecting device id when we leave connecting state
  useEffect(() => {
    if (!isConnecting) {
      setConnectingDeviceId(null);
    }
  }, [isConnecting]);

  const handleScan = useCallback(async () => {
    try {
      await startScan();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start scan';
      Alert.alert('Bluetooth Error', message, [{ text: 'OK' }]);
    }
  }, [startScan]);

  const handleStop = useCallback(() => {
    stopScan();
  }, [stopScan]);

  const handleDevicePress = useCallback(
    (deviceId: string) => {
      setConnectingDeviceId(deviceId);
      connectToDevice(deviceId);
    },
    [connectToDevice]
  );

  const renderDevice = ({ item }: ListRenderItemInfo<FoundDevice>) => (
    <DeviceRow
      device={item}
      onPress={() => handleDevicePress(item.id)}
      disabled={isConnecting}
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Wordmark */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>REZO</Text>
          <Text style={styles.subtitle}>Haptic Metronome</Text>
        </View>

        {/* Scan animation area */}
        <View style={styles.animContainer}>
          <ScanAnimation active={isScanning} />
        </View>

        {/* Status */}
        <View style={styles.statusArea}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(connectionState) }]} />
          <Text style={[styles.statusText, { color: statusColor(connectionState) }]}>
            {isConnecting && connectingDeviceId
              ? `Connecting to ${foundDevices.find((d) => d.id === connectingDeviceId)?.name ?? 'device'}...`
              : statusLabel(connectionState)}
          </Text>
        </View>

        {/* Device list (shown while scanning or after scan with results) */}
        {(isScanning || foundDevices.length > 0) && !isConnecting && (
          <View style={styles.deviceListArea}>
            {foundDevices.length === 0 ? (
              <View style={styles.lookingRow}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={styles.lookingText}>Looking for devices…</Text>
              </View>
            ) : (
              <FlatList
                data={foundDevices}
                renderItem={renderDevice}
                keyExtractor={(item) => item.id}
                style={styles.deviceList}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {/* Connecting spinner */}
        {isConnecting && (
          <View style={styles.connectingArea}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.connectingText}>
              {connectingDeviceId
                ? `Connecting to ${foundDevices.find((d) => d.id === connectingDeviceId)?.name ?? 'device'}`
                : 'Connecting...'}
            </Text>
          </View>
        )}

        {/* Scan / Stop button */}
        <View style={styles.buttonArea}>
          {isConnecting ? null : isScanning ? (
            <TouchableOpacity
              style={styles.stopButton}
              onPress={handleStop}
              activeOpacity={0.8}
            >
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScan}
              activeOpacity={0.8}
            >
              <Text style={styles.scanButtonText}>Scan for Devices</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer hint */}
        <Text style={styles.hint}>
          Make sure your bracelet is powered on and within range.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 52,
    fontWeight: '100',
    color: theme.colors.text,
    letterSpacing: 18,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textDim,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  animContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  statusArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: theme.fontSize.body,
    letterSpacing: 1,
  },
  deviceListArea: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: theme.spacing.sm,
  },
  deviceList: {
    width: '100%',
  },
  lookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  lookingText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textDim,
  },
  connectingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  connectingText: {
    fontSize: theme.fontSize.body,
    color: theme.colors.textDim,
    textAlign: 'center',
  },
  buttonArea: {
    width: '100%',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  scanButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.borderRadius.sm,
    width: '100%',
    alignItems: 'center',
  },
  scanButtonText: {
    fontSize: theme.fontSize.h2,
    fontWeight: '600',
    color: '#0A0A10',
    letterSpacing: 0.5,
  },
  stopButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.borderRadius.sm,
    width: '100%',
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: theme.fontSize.h2,
    fontWeight: '600',
    color: theme.colors.textDim,
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});
