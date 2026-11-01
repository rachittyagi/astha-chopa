// Quick presets for 1–4 human players (R-MODE-01..03). A preset only pre-fills the seats.
import type { SeatConfig, SeatKind } from '@/engine';
import i18next from '@/i18n';
import type { GameSetup } from '@/services/persistence';
import { defaultRules } from '@/store/settings';
import { DEFAULT_SEAT_COLORS, PAWN_COLORS } from '@/ui/theme';

export type PlayerCount = 1 | 2 | 3 | 4;
export const PLAYER_COUNTS: PlayerCount[] = [1, 2, 3, 4];

const KINDS: Record<PlayerCount, SeatKind[]> = {
  1: ['human', 'empty', 'bot', 'empty'],
  2: ['human', 'empty', 'human', 'empty'],
  3: ['human', 'human', 'human', 'empty'],
  4: ['human', 'human', 'human', 'human'],
};

export function defaultNames(): string[] {
  // In the app's language ("Player 1", "खिलाड़ी 1"); names already typed are kept as they are.
  return [1, 2, 3, 4].map((n) => i18next.t('setup.defaultName', { n }));
}

/** Seats for a preset, keeping names and colours the user already chose. */
export function presetSeats(count: PlayerCount, current?: SeatConfig[]): SeatConfig[] {
  return KINDS[count].map((kind, i) => {
    const name = current?.[i]?.name ?? defaultNames()[i]!;
    const color = current?.[i]?.color ?? DEFAULT_SEAT_COLORS[i]!;
    return kind === 'bot' ? { kind, name, color, botLevel: 'medium' } : { kind, name, color };
  });
}

/** The next colour not used by another playing seat (R-MODE-04). */
export function nextColor(seats: SeatConfig[], index: number): string {
  const palette = Object.keys(PAWN_COLORS);
  const used = new Set(seats.filter((s, i) => i !== index && s.kind !== 'empty').map((s) => s.color));
  const start = palette.indexOf(seats[index]!.color);
  for (let k = 1; k <= palette.length; k++) {
    const candidate = palette[(start + k) % palette.length]!;
    if (!used.has(candidate)) return candidate;
  }
  return seats[index]!.color;
}

export function setKind(seats: SeatConfig[], index: number, kind: SeatKind): SeatConfig[] {
  return seats.map((s, i) => {
    if (i !== index) return s;
    const { botLevel: _drop, ...rest } = s;
    return kind === 'bot' ? { ...rest, kind, botLevel: s.botLevel ?? 'medium' } : { ...rest, kind };
  });
}

/** First launch: you against a Medium computer player, Classic rules with the Settings inner-ring default. */
export function firstSetup(innerRing: 'open' | 'hit'): GameSetup {
  return { seats: presetSeats(1), config: defaultRules({ innerRing }) };
}
