// Board themes (R-UX-01): chalk-on-floor (default), wooden board, modern flat.
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
  highlight: string;
  preview: string;
  danger: string;
  overlay: string;
  onOverlay: string;
}

export type ThemeName = Settings['theme'];

export const THEMES: Record<ThemeName, Theme> = {
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
  },
  wood: {
    background: '#f3e6cf',
    surface: '#fffaf0',
    board: '#c8955a',
    boardLine: '#4a2e14',
    safeMark: '#4a2e14',
    text: '#2b1d10',
    muted: '#5e4634',
    accent: '#7a3e12',
    onAccent: '#ffffff',
    highlight: '#ffd36b',
    preview: 'rgba(255, 236, 170, 0.6)',
    danger: '#a3221b',
    overlay: 'rgba(0, 0, 0, 0.6)',
    onOverlay: '#ffffff',
  },
  flat: {
    background: '#f6f7fb',
    surface: '#ffffff',
    board: '#ffffff',
    boardLine: '#b9bfcc',
    safeMark: '#7a8194',
    text: '#1c1f26',
    muted: '#525868',
    accent: '#3949ab',
    onAccent: '#ffffff',
    highlight: '#ffb300',
    preview: 'rgba(255, 179, 0, 0.25)',
    danger: '#c62828',
    overlay: 'rgba(0, 0, 0, 0.6)',
    onOverlay: '#ffffff',
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
