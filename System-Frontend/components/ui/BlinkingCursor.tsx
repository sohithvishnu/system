import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS, FONT, FONT_FAMILY } from '../../constants/theme';

interface BlinkingCursorProps {
  style?: any;
}

export function BlinkingCursor({ style }: BlinkingCursorProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0, { duration: 500, easing: Easing.linear }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <Animated.Text style={[styles.cursor, animatedStyle, style]}>
      _
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  cursor: {
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.accent,
    fontWeight: '600',
  },
});
