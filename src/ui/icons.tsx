// Icons: a 24 pt grid, 2 pt round stroke, drawn in brown unless a colour is given.
import Svg, { Path } from 'react-native-svg';

import { SEAT_SHAPES } from './theme';

import type { SeatId } from '@/engine';

export const ICONS = {
  pause: 'M9 6v12M15 6v12',
  sound: 'M4 10h3l5-4v12l-5-4H4ZM16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10',
  muted: 'M4 10h3l5-4v12l-5-4H4ZM16 9l5 6M21 9l-5 6',
  faster: 'M4 6l7 6-7 6ZM12 6l7 6-7 6Z',
  safe: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6ZM8.6 12l2.4 2.4 4.4-4.8',
  hit: 'M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z',
  danger: 'M12 4l9 16H3ZM12 10v4.5M12 17v.4',
  locked: 'M8 11V8a4 4 0 0 1 8 0v3M6.5 11h11v8h-11Z',
  unlocked: 'M8 11V8a4 4 0 0 1 7.6-1.7M6.5 11h11v8h-11Z',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  info: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18ZM12 11v6M12 7.5v.5',
  restart: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  home: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4Z',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7Z',
  arrow: 'M5 12h13M13 6l6 6-6 6',
  check: 'M5 12l5 5 9-10',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color = '#7A3E12',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ICONS[name]} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A seat's shape (circle, square, triangle, diamond), filled. */
export function SeatShape({ seat, size = 20, color }: { seat: SeatId; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SEAT_SHAPES[seat].path} fill={color} />
    </Svg>
  );
}
