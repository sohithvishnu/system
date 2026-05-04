import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, FONT_FAMILY, SPACE } from '../../constants/theme';

interface EmptyStateProps {
  item: string;
  hint?: string;
}

export function EmptyState({ item, hint }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>$ no {item} yet</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACE.xl,
  },
  text: {
    fontSize: FONT.base,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.mono,
  },
  hint: {
    fontSize: FONT.sm,
    color: COLORS.textGhost,
    fontFamily: FONT_FAMILY.mono,
    marginTop: SPACE.xs,
  },
});
