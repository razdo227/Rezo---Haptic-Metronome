import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { theme } from '../theme';

interface BeatVisualizerProps {
  totalBeats: number;
  currentBeat: number;
  isPlaying: boolean;
}

interface BeatDotProps {
  index: number;
  isActive: boolean;
  isBeat1: boolean;
  isPlaying: boolean;
}

function BeatDot({ index, isActive, isBeat1, isPlaying }: BeatDotProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isBeat1 ? 0.5 : 0.3)).current;
  const prevActiveRef = useRef(false);

  useEffect(() => {
    if (isActive && isPlaying && !prevActiveRef.current) {
      // Trigger pulse animation on beat
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: isBeat1 ? 1.6 : 1.4,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: isBeat1 ? 0.5 : 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
    prevActiveRef.current = isActive;
  }, [isActive, isPlaying, isBeat1, scaleAnim, opacityAnim]);

  // Reset when not playing
  useEffect(() => {
    if (!isPlaying) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: isBeat1 ? 0.5 : 0.3,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isPlaying, isBeat1, scaleAnim, opacityAnim]);

  const baseSize = isBeat1 ? 18 : 12;
  const dotColor = isBeat1 ? theme.colors.accentDown : theme.colors.accent;

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: baseSize,
          height: baseSize,
          borderRadius: baseSize / 2,
          backgroundColor: dotColor,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
          marginHorizontal: isBeat1 ? 6 : 4,
        },
      ]}
    />
  );
}

export default function BeatVisualizer({ totalBeats, currentBeat, isPlaying }: BeatVisualizerProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalBeats }, (_, i) => (
        <BeatDot
          key={i}
          index={i}
          isActive={currentBeat === i}
          isBeat1={i === 0}
          isPlaying={isPlaying}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    minHeight: 40,
  },
  dot: {
    // Dynamic styles applied inline
  },
});
