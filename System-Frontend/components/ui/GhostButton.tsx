import React from 'react';
import { Text, StyleSheet, ViewStyle, Platform, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';

interface GhostButtonProps {
  label: string;
  onPress: () => void;
  icon?: string;
  style?: ViewStyle;
  danger?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GhostButton({ label, onPress, icon, style, danger }: GhostButtonProps) {
  const textColor = danger ? COLORS.danger : COLORS.textMuted;
  const borderColor = danger ? COLORS.danger : COLORS.borderMid;
  const scale = useSharedValue(1);

  const handlePressIn = async () => {
    scale.value = withSpring(0.97, { damping: 10, mass: 1, overshootClamping: true });
    if (Platform.OS !== 'web') {
      try {
        const hapticType = danger
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.ImpactFeedbackStyle.Light;
        if (danger) {
          await Haptics.notificationAsync(hapticType as any);
        } else {
          await Haptics.impactAsync(hapticType as any);
        }
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
      style={[styles.btn, { borderColor }, style, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {icon ? <Feather name={icon as any} size={FONT.md} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{label.toLowerCase()}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
  },
  label: {
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  },
});
