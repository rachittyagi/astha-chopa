// Design tokens: "a wooden board on a courtyard floor" (R-UX-01).
// The app around the board is always the warm cream courtyard; the four themes change the board.
import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useSettings } from '@/store/app';
import type { Settings } from '@/store/settings';

export interface Theme {
  /** bg.page: the cream ground every screen sits on. */
  background: string;
  /** bg.surface: cards, panels and sheets. */
  surface: string;
  /** line.subtle: hairlines round cards and between rows. */
  line: string;
  /** A stronger line for secondary buttons and inputs. */
  lineStrong: string;
  /** The recessed track behind segmented controls. */
  track: string;
  text: string;
  muted: string;
  /** brand.primary: the deep brown of primary buttons and headings. */
  accent: string;
  /** The darker brown under a primary button (its pressed-in edge). */
  accentEdge: string;
  onAccent: string;
  /** Ink for secondary buttons. */
  ink: string;
  danger: string;
  dangerSurface: string;
  overlay: string;
  onOverlay: string;

  // The board, which is what the four themes change.
  /** Outer frame (wood, maroon, slate or black). */
  boardFrame: string;
  /** Plain outer-ring squares. */
  board: string;
  /** Inner-ring squares, a shade darker. */
  boardInner: string;
  /** The home square in the middle. */
  boardCentre: string;
  /** Lines between squares. */
  boardLine: string;
  /** Crosses on safe squares, the lotus at home and the inner-ring lock. */
  safeMark: string;
  /** Diya lamps instead of crosses (Festival). */
  diyas: boolean;
  /** How strongly a start square is tinted in its owner's colour. */
  startTint: number;
  /**
   * The outer edge of the tap ring round pawns that can move: at least 3:1 against the board.
   * Inside it the ring is always white and gold (`TAP`), so "you can tap this" looks the same everywhere.
   */
  highlight: string;
  /** Squares a chosen pawn will pass over, numbered 1·2·3. */
  preview: string;
  previewInk: string;
  /** Outline round each pawn, chosen to stand out from this board. */
  pawnOutline: string;
}

export type ThemeName = Settings['theme'];

/** The courtyard: shared by every theme. */
const PAGE = {
  background: '#F2E6D0',
  surface: '#FBF4E6',
  line: '#E2CDA8',
  lineStrong: '#C9AE86',
  track: '#E9D9BC',
  text: '#2B1A0E',
  muted: '#5E4532',
  accent: '#7A3E12',
  accentEdge: '#4A240A',
  onAccent: '#FFF6E6',
  ink: '#4A240A',
  danger: '#A1221B',
  dangerSurface: '#FFF1EE',
  overlay: 'rgba(43, 26, 14, 0.62)',
  onOverlay: '#FFFFFF',
} as const;

export const THEMES: Record<ThemeName, Theme> = {
  // Turned-wood frame, light wood squares, carved crosses, a lotus at home.
  wood: {
    ...PAGE,
    boardFrame: '#6E3A14',
    board: '#EBCB98',
    boardInner: '#E2BC84',
    boardCentre: '#D6A468',
    boardLine: '#6A3410',
    safeMark: '#7A3E12',
    diyas: false,
    startTint: 0.24,
    highlight: '#4A240A',
    preview: 'rgba(255, 249, 230, 0.82)',
    previewInk: '#7A3E12',
    pawnOutline: '#2B1A0E',
  },
  // Maroon frame with a rangoli border; diyas light the safe squares; marigold centre.
  festive: {
    ...PAGE,
    boardFrame: '#741C2A',
    board: '#F8E8CC',
    boardInner: '#F3D7AA',
    boardCentre: '#F6C863',
    boardLine: '#9B2C3A',
    safeMark: '#9B2C3A',
    diyas: true,
    startTint: 0.24,
    highlight: '#5E1420',
    preview: 'rgba(255, 255, 255, 0.85)',
    previewInk: '#9B2C3A',
    pawnOutline: '#2B1A0E',
  },
  // Dark slate with chalk lines; start squares tint stronger so seats read on the dark ground.
  chalk: {
    ...PAGE,
    boardFrame: '#1B1F1D',
    board: '#3A413E',
    boardInner: '#343B38',
    boardCentre: '#48504C',
    boardLine: '#D9D5C8',
    safeMark: '#F4F0E4',
    diyas: false,
    startTint: 0.38,
    highlight: '#FFD25A',
    preview: 'rgba(255, 255, 255, 0.2)',
    previewInk: '#FFFFFF',
    pawnOutline: '#FFFFFFCC',
  },
  // Near-black lines on white, bold crosses, no texture: the highest contrast.
  flat: {
    ...PAGE,
    boardFrame: '#211A16',
    board: '#FFFFFF',
    boardInner: '#F1EBE2',
    boardCentre: '#FFE2A6',
    boardLine: '#211A16',
    safeMark: '#211A16',
    diyas: false,
    startTint: 0.16,
    highlight: '#211A16',
    preview: 'rgba(255, 216, 120, 0.45)',
    previewInk: '#211A16',
    pawnOutline: '#211A16',
  },
};

/** The tap ring: a white inner ring, a pale gold outer ring and a glow. It means one thing only. */
export const TAP = { inner: '#FFFFFF', gold: '#FFD25A', glow: 'rgba(255, 210, 90, 0.6)' } as const;

/** Board states: safe landing, hit, risky landing, the inner ring opening, a run of big throws. */
export const STATE = {
  safe: '#3F8F5A',
  safeInk: '#1F5A37',
  safeSurface: '#E3F1E6',
  hit: '#C62828',
  hitInk: '#8E1D17',
  hitSurface: '#FBE3E0',
  danger: '#D63A2F',
  dangerInk: '#8E2A12',
  dangerSurface: '#FDE7DA',
  unlock: '#D4A017',
  warning: '#F08A24',
  gold: '#FFF0C7',
  goldInk: '#5C3B00',
  info: '#F3E6CF',
  infoInk: '#4E3826',
} as const;

/** The cowrie tray: turned wood round a red cloth well, brass coins for banked throws. */
export const TRAY = {
  woodTop: '#9A5A28',
  wood: '#6E3A14',
  woodEdge: '#4A240A',
  cloth: '#A3313B',
  clothDeep: '#6B1622',
  onWood: '#FFE7C2',
  onWoodMuted: '#F3D9B4',
  brass: '#E2AE48',
  brassLight: '#FFF0B8',
  brassDeep: '#A8741B',
  bonus: '#E06A4E',
  button: '#FBEBD2',
  buttonEdge: '#3B1D08',
} as const;

/**
 * Seat colours offered at setup (R-MODE-04); the same in every theme. Yellow is pushed to saffron
 * so it never sits close to the gold tap ring, and carries dark ink.
 */
export const PAWN_COLORS: Record<string, string> = {
  red: '#C23B2A',
  green: '#2F7D4E',
  yellow: '#E39B0B',
  blue: '#2E5AA8',
  purple: '#7D4FB3',
  orange: '#D9772B',
};

export const DEFAULT_SEAT_COLORS = ['red', 'green', 'yellow', 'blue'];

/** Each seat also gets its own shape, so colour is never the only cue (R-UX-02). */
export const SEAT_SHAPES = {
  A: { shape: 'circle', symbol: '●', path: 'M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15Z' },
  B: { shape: 'square', symbol: '■', path: 'M5.5 5.5h13v13h-13Z' },
  C: { shape: 'triangle', symbol: '▲', path: 'M12 4.5l8 14h-16Z' },
  D: { shape: 'diamond', symbol: '◆', path: 'M12 3.5l8.5 8.5-8.5 8.5-8.5-8.5Z' },
} as const;

export const MIN_TOUCH = 44;

/**
 * Typefaces: Baloo 2 for display (rounded, warm, Devanagari), Hind for the UI (clean, Devanagari).
 * Each weight is its own family, so styles set `fontFamily` and never `fontWeight` (Android would
 * otherwise fall back to the system font).
 */
export const fonts = {
  display: 'Baloo2_800ExtraBold',
  heading: 'Baloo2_700Bold',
  body: 'Hind_400Regular',
  medium: 'Hind_500Medium',
  semibold: 'Hind_600SemiBold',
  bold: 'Hind_700Bold',
} as const;

/** Type scale (pt). Screens pick from these instead of one-off sizes. */
export const font = {
  overline: 12,
  caption: 14,
  label: 15,
  body: 16,
  button: 17,
  heading: 22,
  title: 32,
  display: 48,
} as const;

/** Spacing scale (pt) for padding and gaps. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Corner radii (pt): cells, chips, buttons, panels, sheets and fully round. */
export const radius = { sm: 6, md: 12, lg: 16, xl: 24, sheet: 28, round: 999 } as const;

/** Shadows: raised cards, docked panels and overlays. */
export const shadow = {
  raised: { boxShadow: '0 2px 6px rgba(122, 62, 18, 0.18)' },
  panel: { boxShadow: '0 12px 28px rgba(122, 62, 18, 0.25)' },
  overlay: { boxShadow: '0 24px 60px rgba(43, 26, 14, 0.4)' },
} as const;

/** Ink for text and shapes on a player's colour: white, or dark brown on saffron. */
export function onPlayer(color: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.05 ? '#FFFFFF' : '#3B1D08';
}

/** Mix two #rrggbb colours: t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [A, B] = [ch(a), ch(b)];
  return `#${A.map((v, i) => Math.round(v + (B[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

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
