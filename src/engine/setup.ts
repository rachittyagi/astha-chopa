import { isValidConfig, type RuleConfig } from './config';
import { botSeedState, seedState } from './rng';
import { SEAT_IDS, type GameState, type Pawn, type Seat, type SeatConfig } from './types';

export const PAWNS_PER_SEAT = 4;

export type SeatProblem = 'wrongSeatCount' | 'tooFewPlayers' | 'noHuman' | 'duplicateColor';

/** Problems that block Start (R-SEAT-02, R-MODE-04); empty when the seats are playable. */
export function validateSeats(seats: readonly SeatConfig[]): SeatProblem[] {
  if (seats.length !== SEAT_IDS.length) return ['wrongSeatCount'];
  const problems: SeatProblem[] = [];
  const playing = seats.filter((s) => s.kind !== 'empty');
  if (playing.length < 2) problems.push('tooFewPlayers');
  if (!playing.some((s) => s.kind === 'human')) problems.push('noHuman');
  const colors = playing.map((s) => s.color.toLowerCase());
  if (new Set(colors).size !== colors.length) problems.push('duplicateColor');
  return problems;
}

export function createGame(
  seatConfigs: readonly SeatConfig[],
  config: RuleConfig,
  seed: number,
  id: string,
  createdAt: number,
): GameState {
  const problems = validateSeats(seatConfigs);
  if (problems.length > 0) throw new Error(`Invalid seats: ${problems.join(', ')}`);
  if (!isValidConfig(config)) throw new Error('Invalid rule config');

  const seats: Seat[] = SEAT_IDS.map((seatId, i) => {
    const cfg = seatConfigs[i]!;
    return { ...cfg, id: seatId, hasHit: false, finishedRank: null, prevTurnStart: 0 };
  });

  const startIndex = config.entryRule === 'onStart' ? 0 : null;
  const pawns: Pawn[] = seats
    .filter((s) => s.kind !== 'empty')
    .flatMap((s) =>
      Array.from({ length: PAWNS_PER_SEAT }, (_, n) => ({
        id: `${s.id}${n}`,
        seat: s.id,
        pathIndex: startIndex,
        progress: 0,
      })),
    );

  const first = seats.find((s) => s.kind !== 'empty')!;

  return {
    id,
    schemaVersion: 1,
    createdAt,
    seed,
    seats,
    pawns,
    ruleConfig: { ...config },
    rngState: seedState(seed),
    botRngState: botSeedState(seed),
    phase: 'throwing',
    currentSeat: first.id,
    turnNumber: 1,
    turnStartedAt: 1,
    pool: [],
    nextThrowId: 1,
    inBonusSequence: false,
    consecutiveChammaAshta: 0,
    pendingBonusThrows: 0,
    doubles: [],
    stalemateBroken: false,
    rankings: [],
    log: [],
  };
}
