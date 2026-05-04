import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, FONT_FAMILY, SPACE } from '../../constants/theme';

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

export function Section({ label, children }: SectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toLowerCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACE.lg,
  },
  label: {
    fontSize: FONT.sm,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
    letterSpacing: 0.04 * FONT.sm,
    marginBottom: SPACE.sm,
    textTransform: 'lowercase',
  },
});
