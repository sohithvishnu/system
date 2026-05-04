import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, FONT_FAMILY, SPACE, RADIUS } from '../../constants/theme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export function PageHeader({ title, subtitle, rightAction }: PageHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flex: 1 },
  title: {
    fontSize: FONT.xxl,
    color: COLORS.textPrimary,
    fontWeight: '500',
    fontFamily: FONT_FAMILY.sans,
  },
  subtitle: {
    fontSize: FONT.md,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.mono,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    marginLeft: SPACE.md,
  },
});
