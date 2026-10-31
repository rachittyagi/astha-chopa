import {
  activeSeats,
  HOME_INDEX,
  isSafe,
  movesWithValue,
  squareOf,
  THROW_ODDS,
  THROW_VALUES,
  type GameState,
} from '../engine';

/**
 * Chance that some opponent can hit this pawn with a single throw on their next turn,
 * weighted by the real throw odds (R-THROW-03). Chained throws (4 then 3) are ignored,
 * as the PRD's "in reach" definition does.
 */
export function hitChance(state: GameState, pawnId: string): number {
  const pawn = state.pawns.find((p) => p.id === pawnId);
  if (!pawn || pawn.pathIndex === null || pawn.pathIndex === HOME_INDEX) return 0;
  const square = squareOf(pawn);
  if (!square || isSafe(square)) return 0;

  let missedByAll = 1;
  for (const opponent of activeSeats(state)) {
    if (opponent.id === pawn.seat) continue;
    let chance = 0;
    for (const value of THROW_VALUES) {
      if (movesWithValue(state, opponent.id, value).some((m) => m.hits.includes(pawnId))) {
        chance += THROW_ODDS[value];
      }
    }
    missedByAll *= 1 - chance;
  }
  return 1 - missedByAll;
}

/** Chance that a seat can hit some opponent with a single throw on its next turn. */
export function threatChance(state: GameState, seat: GameState['currentSeat']): number {
  let chance = 0;
  for (const value of THROW_VALUES) {
    if (movesWithValue(state, seat, value).some((m) => m.hits.length > 0)) chance += THROW_ODDS[value];
  }
  return chance;
}
