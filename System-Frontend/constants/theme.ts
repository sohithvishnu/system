import { scale } from '../utils/responsive';

export const COLORS = {
  bg:            '#0a0a0a',
  surface:       '#0d0d0d',
  surfaceAlt:    '#0f0f0f',
  border:        '#141414',
  borderMid:     '#1a1a1a',
  borderHover:   '#222222',
  textPrimary:   '#d0d0d0',
  textSecondary: '#888888',
  textMuted:     '#555555',
  textGhost:     '#2e2e2e',
  white:         '#ffffff',
  accent:        '#00FF66',
  accentGlow:    'rgba(0,255,102,0.6)',
  accentSoft:    'rgba(0,255,102,0.5)',
  accentTint:    'rgba(0,255,102,0.06)',
  danger:        '#FF2C55',
  warning:       '#FFB800',
  info:          '#38bdf8',
  purple:        '#a78bfa',
};

export const ENTITY_COLORS: { [key: string]: string } = {
  TO_DO:    COLORS.accent,
  DEADLINE: COLORS.danger,
  MEETING:  COLORS.info,
  REST:     COLORS.purple,
};

export const PRIORITY_COLORS: { [key: string]: string } = {
  HIGH:   COLORS.danger,
  MEDIUM: COLORS.warning,
  LOW:    COLORS.accent,
};

export const RADIUS = { sm: 5, md: 6, lg: 8 };

export const FONT = {
  xs:  scale(9),
  sm:  scale(10),
  base: scale(11),
  md:  scale(12),
  lg:  scale(13),
  xl:  scale(15),
  xxl: scale(18),
};

export const SPACE = {
  xs: scale(4),
  sm: scale(6),
  md: scale(10),
  lg: scale(14),
  xl: scale(20),
};

export const FONT_FAMILY = {
  mono: 'Courier New',
  sans: 'System',
};

// Legacy aliases
export const BOLD_STYLES = {
  radius: { sm: 5, md: 6, lg: 8, pill: 20 },
  border: 1,
};
