// Doubles (R-DBL-01..05, R-CFG-04): two or more of one player's pawns on one non-safe square.
import { isSafe, sameSquare, squareKey } from './board';
import { squareOf } from './occupancy';
import type { DoubleRec, GameEvent, GameState, Seat, SeatId, Square } from './types';

/** An outer-ring square: on the board's edge (R-BOARD-03). */
export function isOuterSquare([r, c]: Square): boolean {
  return r === 0 || r === 4 || c === 0 || c === 4;
}

/** Current stacks that count as doubles, keyed by owner and square, pawn ids sorted. */
function currentStacks(state: GameState): { owner: SeatId; square: Square; pawnIds: string[] }[] {
  if (!state.ruleConfig.doubles) return [];
  const groups = new Map<string, { owner: SeatId; square: Square; pawnIds: string[] }>();
  for (const pawn of state.pawns) {
    const square = squareOf(pawn);
    if (!square || isSafe(square)) continue;
    const key = `${pawn.seat}:${squareKey(square)}`;
    const group = groups.get(key) ?? { owner: pawn.seat, square, pawnIds: [] };
    group.pawnIds.push(pawn.id);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((g) => g.pawnIds.length >= 2)
    .map((g) => ({ ...g, pawnIds: g.pawnIds.sort() }));
}

const sameMembers = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Bring the double records in line with the board after a move. A record survives only
 * if its owner, square and pawns are unchanged; any change makes a new double with a
 * new formedAtTurn (R-CFG-04).
 */
export function reconcileDoubles(draft: GameState, events: GameEvent[]): void {
  const next: DoubleRec[] = [];
  for (const stack of currentStacks(draft)) {
    const old = draft.doubles.find((d) => d.owner === stack.owner && sameSquare(d.square, stack.square));
    if (old && sameMembers(old.pawnIds, stack.pawnIds)) {
      next.push(old);
      continue;
    }
    next.push({ ...stack, formedAtTurn: draft.turnNumber });
    if (!old) events.push({ type: 'DoubleFormed', owner: stack.owner, square: stack.square });
  }
  for (const old of draft.doubles) {
    if (!next.some((d) => d.owner === old.owner && sameSquare(d.square, old.square))) {
      events.push({ type: 'DoubleBroken', owner: old.owner, square: old.square });
    }
  }
  draft.doubles = next;
}

/**
 * blockOnce (R-DBL-02): an opponent's outer-ring double on a passed square stops the mover
 * during the mover's first turn that started after the double formed.
 */
export function blockedByDouble(state: GameState, mover: Seat, passed: readonly Square[]): boolean {
  if (state.ruleConfig.doubleCrossing !== 'blockOnce') return false;
  return state.doubles.some(
    (d) =>
      d.owner !== mover.id &&
      isOuterSquare(d.square) &&
      mover.prevTurnStart < d.formedAtTurn &&
      passed.some((sq) => sameSquare(sq, d.square)),
  );
}
