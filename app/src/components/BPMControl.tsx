import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from '../theme';
import { BPM_MIN, BPM_MAX } from '../constants/ble';

interface BPMControlProps {
  bpm: number;
  onBPMChange: (bpm: number) => void;
}

const LONG_PRESS_INITIAL_DELAY = 400;
const LONG_PRESS_INTERVAL = 80;
const ACCELERATION_THRESHOLD = 2000;
const ACCELERATION_STEP = 5;

export default function BPMControl({ bpm, onBPMChange }: BPMControlProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartRef = useRef<number>(0);
  const currentBPMRef = useRef<number>(bpm);
  currentBPMRef.current = bpm;

  const clamp = (val: number) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(val)));

  const stopContinuousChange = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startContinuousChange = useCallback(
    (direction: 1 | -1) => {
      stopContinuousChange();
      pressStartRef.current = Date.now();

      // Immediate first change
      const first = clamp(currentBPMRef.current + direction);
      currentBPMRef.current = first;
      onBPMChange(first);

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - pressStartRef.current;
        const step = elapsed > ACCELERATION_THRESHOLD ? ACCELERATION_STEP : 1;
        const next = clamp(currentBPMRef.current + direction * step);
        currentBPMRef.current = next;
        onBPMChange(next);
      }, LONG_PRESS_INTERVAL);
    },
    [onBPMChange, stopContinuousChange]
  );

  const handleSinglePress = (direction: 1 | -1) => {
    const next = clamp(bpm + direction);
    onBPMChange(next);
  };

  const handleSliderChange = (value: number) => {
    onBPMChange(Math.round(value));
  };

  return (
    <View style={styles.container}>
      {/* BPM Display Row */}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.adjButton}
          onPress={() => handleSinglePress(-1)}
          onLongPress={() => startContinuousChange(-1)}
          onPressOut={stopContinuousChange}
          delayLongPress={LONG_PRESS_INITIAL_DELAY}
          activeOpacity={0.7}
        >
          <Text style={styles.adjButtonText}>−</Text>
        </TouchableOpacity>

        <View style={styles.bpmDisplay}>
          <Text style={styles.bpmNumber}>{bpm}</Text>
          <Text style={styles.bpmLabel}>BPM</Text>
        </View>

        <TouchableOpacity
          style={styles.adjButton}
          onPress={() => handleSinglePress(1)}
          onLongPress={() => startContinuousChange(1)}
          onPressOut={stopContinuousChange}
          delayLongPress={LONG_PRESS_INITIAL_DELAY}
          activeOpacity={0.7}
        >
          <Text style={styles.adjButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Slider */}
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderEndLabel}>{BPM_MIN}</Text>
        <Slider
          style={styles.slider}
          minimumValue={BPM_MIN}
          maximumValue={BPM_MAX}
          step={1}
          value={bpm}
          onValueChange={handleSliderChange}
          minimumTrackTintColor={theme.colors.accent}
          maximumTrackTintColor={theme.colors.surfaceAlt}
          thumbTintColor={theme.colors.accent}
        />
        <Text style={styles.sliderEndLabel}>{BPM_MAX}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  adjButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjButtonText: {
    fontSize: 28,
    color: theme.colors.accent,
    lineHeight: 32,
    fontWeight: '300',
  },
  bpmDisplay: {
    alignItems: 'center',
    marginHorizontal: theme.spacing.xl,
    minWidth: 140,
  },
  bpmNumber: {
    fontSize: theme.fontSize.display,
    fontWeight: '200',
    color: theme.colors.text,
    letterSpacing: -2,
    lineHeight: theme.fontSize.display + 8,
  },
  bpmLabel: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    letterSpacing: 3,
    marginTop: -4,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  slider: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
    height: 40,
  },
  sliderEndLabel: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.textDim,
    width: 28,
    textAlign: 'center',
  },
});
