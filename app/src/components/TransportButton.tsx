import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { theme } from '../theme';

interface TransportButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export default function TransportButton({ isPlaying, onPress, disabled = false }: TransportButtonProps) {
  const { width } = useWindowDimensions();
  const buttonSize = Math.round(width * 0.52);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(isPlaying ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: isPlaying ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isPlaying, colorAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const bgColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.accent, theme.colors.accentDown],
  });

  const borderColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.accent + 'AA', theme.colors.accentDown + 'AA'],
  });

  return (
    // Outer: scale + opacity (native driver only)
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: disabled ? 0.4 : 1,
      }}
    >
    {/* Inner: border color (JS driver only) */}
    <Animated.View
      style={[
        styles.outerRing,
        {
          width: buttonSize + 16,
          height: buttonSize + 16,
          borderRadius: (buttonSize + 16) / 2,
          borderColor: borderColor,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
        style={[
          styles.button,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.buttonFill,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor: bgColor,
            },
          ]}
        >
          <Text style={[styles.icon, { fontSize: Math.round(buttonSize * 0.35) }]}>
            {isPlaying ? '■' : '▶'}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonFill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: '#0A0A0F',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
