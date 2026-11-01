// Board themes (R-UX-01): festival (default), chalk-on-floor, wooden board, modern flat.
import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useSettings } from '@/store/app';
import type { Settings } from '@/store/settings';

export interface Theme {
  background: string;
  surface: string;
  board: string;
  boardLine: string;
  safeMark: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  /** Ring round pawns that can move; at least 3:1 against the board. */
  highlight: string;
  preview: string;
  danger: string;
  overlay: string;
  onOverlay: string;
  /** Outline round each pawn, chosen to stand out from this board. */
  pawnOutline: string;
}

export type ThemeName = Settings['theme'];

export const THEMES: Record<ThemeName, Theme> = {
  // Warm, bright and high-contrast: marigold board, saffron buttons, rangoli magenta marks.
  festive: {
    background: '#fff4e0',
    surface: '#ffffff',
    board: '#ffd98f',
    boardLine: '#7a2e00',
    safeMark: '#b0124f',
    text: '#2a1608',
    muted: '#5a3e26',
    accent: '#b83a00',
    onAccent: '#ffffff',
    highlight: '#0a7ea4',
    preview: 'rgba(10, 126, 164, 0.28)',
    danger: '#a3160f',
    overlay: 'rgba(42, 22, 8, 0.78)',
    onOverlay: '#ffffff',
    pawnOutline: '#2a1608',
  },
  chalk: {
    background: '#26302b',
    surface: '#34403a',
    board: '#2c3832',
    boardLine: '#e9e4d8',
    safeMark: '#f4efe1',
    text: '#f4efe6',
    muted: '#cfc8b8',
    accent: '#e8b04a',
    onAccent: '#1f1a12',
    highlight: '#ffd36b',
    preview: 'rgba(255, 211, 107, 0.28)',
    danger: '#ff9e94',
    overlay: 'rgba(0, 0, 0, 0.7)',
    onOverlay: '#ffffff',
    pawnOutline: '#ffffffcc',
  },
  wood: {
    background: '#f3e6cf',
    surface: '#fffaf0',
    // Light maple: red, blue and purple pawns stand out by fill (≥3:1); the dark outline carries the rest.
    board: '#e8c99a',
    boardLine: '#4a2e14',
    safeMark: '#4a2e14',
    text: '#2b1d10',
    muted: '#5e4634',
    accent: '#7a3e12',
    onAccent: '#ffffff',
    highlight: '#123a7a',
    preview: 'rgba(18, 58, 122, 0.3)',
    danger: '#a3221b',
    overlay: 'rgba(0, 0, 0, 0.6)',
    onOverlay: '#ffffff',
    pawnOutline: '#2b1d10',
  },
  flat: {
    background: '#f6f7fb',
    surface: '#ffffff',
    board: '#ffffff',
    boardLine: '#7d8496',
    safeMark: '#7a8194',
    text: '#1c1f26',
    muted: '#525868',
    accent: '#3949ab',
    onAccent: '#ffffff',
    highlight: '#00897b',
    preview: 'rgba(0, 137, 123, 0.22)',
    danger: '#c62828',
    overlay: 'rgba(0, 0, 0, 0.6)',
    onOverlay: '#ffffff',
    pawnOutline: '#2b1d10',
  },
};

/** Seat colours offered at setup (R-MODE-04); the same in every theme. */
export const PAWN_COLORS: Record<string, string> = {
  red: '#c0392b',
  green: '#2e8b57',
  yellow: '#d4a017',
  blue: '#2f6fb3',
  purple: '#7d4fb3',
  orange: '#d9772b',
};

export const DEFAULT_SEAT_COLORS = ['red', 'green', 'yellow', 'blue'];

/** Each seat also gets its own shape and symbol, so colour is never the only cue (R-UX-02). */
export const SEAT_SHAPES = {
  A: { shape: 'circle', symbol: '●' },
  B: { shape: 'square', symbol: '■' },
  C: { shape: 'diamond', symbol: '▲' },
  D: { shape: 'rounded', symbol: '◆' },
} as const;

export const MIN_TOUCH = 44;

/** Type scale (pt). Screens pick from these instead of one-off sizes. */
export const font = {
  caption: 14,
  label: 16,
  body: 18,
  button: 19,
  heading: 22,
  title: 30,
  display: 44,
} as const;

/** Spacing scale (pt) for padding and gaps. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii (pt): controls, cards, sheets, and fully round. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, round: 999 } as const;

export function useTheme(): Theme {
  return THEMES[useSettings((s) => s.theme)];
}

/** Styles built from the active theme, rebuilt only when the theme changes. */
export function useThemedStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(
  factory: (theme: Theme) => T,
) {
  const theme = useTheme();
  const styles = useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
  return { theme, styles };
}
