import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle, View } from 'react-native';
import { COLORS, SPACE } from '../../constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  noPad?: boolean;
}

export function Screen({ children, style, noPad }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.container, style]}>
      <View style={styles.contentWrapper}>
        <View style={[styles.content, noPad ? undefined : styles.padded]}>
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 860,
  },
  padded: {
    paddingHorizontal: SPACE.lg,
  },
});
