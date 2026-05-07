import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONT, FONT_FAMILY, SPACE } from '../../constants/theme';

interface SectionProps {
  label: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Section({ label, children, style }: SectionProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label.toLowerCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACE.xxl,
  },
  label: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
    letterSpacing: 0.04 * FONT.sm,
    marginBottom: SPACE.md,
    textTransform: 'lowercase',
  },
});
