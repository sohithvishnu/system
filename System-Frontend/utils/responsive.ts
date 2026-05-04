import { Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

function getScale(): number {
  if (Platform.OS !== 'web') return 1.0;
  if (width < 768) return 1.0;
  if (width < 1280) return 1.15;
  return 1.3;
}

const SCALE = getScale();

export const scale = (n: number): number => Math.round(n * SCALE);
