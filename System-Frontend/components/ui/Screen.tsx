import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACE } from '../../constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  noPad?: boolean;
}

export function Screen({ children, style, noPad }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.container, noPad ? undefined : styles.padded, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  padded: {
    paddingHorizontal: SPACE.lg,
  },
});
