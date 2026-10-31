// Basic palette for M3. The three board themes (chalk, wood, flat) replace this in M4.
export const colors = {
  background: '#f4efe6',
  surface: '#ffffff',
  board: '#e8dcc8',
  boardLine: '#6b5b45',
  safeMark: '#8a3b12',
  text: '#2b2118',
  muted: '#6b5e50',
  accent: '#8a3b12',
  onAccent: '#ffffff',
  highlight: '#f2c94c',
  preview: 'rgba(242, 201, 76, 0.45)',
  danger: '#b3261e',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

/** Seat colours offered at setup (R-MODE-04). */
export const PAWN_COLORS: Record<string, string> = {
  red: '#c0392b',
  green: '#2e8b57',
  yellow: '#d4a017',
  blue: '#2f6fb3',
  purple: '#7d4fb3',
  orange: '#d9772b',
};

export const DEFAULT_SEAT_COLORS = ['red', 'green', 'yellow', 'blue'];

export const MIN_TOUCH = 44;
