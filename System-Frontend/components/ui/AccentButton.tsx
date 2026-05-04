import React from 'react';
import { Text, StyleSheet, ViewStyle, Platform, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { COLORS, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';

interface AccentButtonProps {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AccentButton({ label, onPress, style }: AccentButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = async () => {
    scale.value = withSpring(0.97, { damping: 10, mass: 1, overshootClamping: true });
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        // Haptics not supported
      }
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, mass: 1, overshootClamping: true });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <AnimatedPressable
      style={[styles.btn, style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Text style={styles.label}>{label.toLowerCase()}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: COLORS.accentTint,
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.18)',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    alignItems: 'center',
  },
  label: {
    color: COLORS.accent,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },
});
