import { isSafe, squareAt, startSquare } from './board';
import { walk } from './movement';
import { pawnsAt, pawnsOf, seatOf } from './occupancy';
import { isExtraThrow, THROW_VALUES } from './throws';
import type { Action, GameState, Move, Pawn, SeatId, Square, ThrowValue } from './types';

type MoveAction = Extract<Action, { type: 'Enter' | 'Move' }>;

/** The lowest-id waiting pawn, which an Enter places on the start square (R-PATH-04). */
function waitingPawn(state: GameState, seat: SeatId): Pawn | undefined {
  return pawnsOf(state, seat).find((p) => p.pathIndex === null);
}

/**
 * Outcome of landing a seat's pawn on a square: the opponent pawns it hits,
 * or null if it may not land there (R-MOVE-04, R-MOVE-05, R-HIT-01..04).
 */
function landing(state: GameState, seat: SeatId, square: Square): string[] | null {
  if (isSafe(square)) return [];
  const opponents = pawnsAt(state, square).filter((p) => p.seat !== seat);
  if (opponents.length === 0) return [];
  if (state.ruleConfig.doubles) {
    // Two or more of one opponent's pawns form a double: no landing on it.
    return opponents.length === 1 ? [opponents[0]!.id] : null;
  }
  // Doubles off: every opponent pawn on the square is hit.
  return opponents.map((p) => p.id);
}

/** The move a seat could make with a throw value, independent of the pool. */
function moveWith(
  state: GameState,
  seat: SeatId,
  action: MoveAction,
  value: ThrowValue,
): Move | null {
  if (action.type === 'Enter') {
    if (state.ruleConfig.entryRule !== 'needChammaOrAshta' || !isExtraThrow(value)) return null;
    const pawn = waitingPawn(state, seat);
    if (!pawn) return null;
    return { action, value, pawnIds: [pawn.id], from: null, to: 0, path: [startSquare(seat)], hits: [] };
  }

  if (action.together) return null; // Moving a double together arrives with doubles (M2).
  const pawn = state.pawns.find((p) => p.id === action.pawnId);
  if (!pawn || pawn.seat !== seat) return null;
  const visited = walk(state, seatOf(state, seat), pawn, value);
  if (!visited) return null;
  const to = visited[visited.length - 1]!;
  const path = visited.map((i) => squareAt(seat, i));
  const hits = landing(state, seat, path[path.length - 1]!);
  if (!hits) return null;
  return { action, value, pawnIds: [pawn.id], from: pawn.pathIndex, to, path, hits };
}

/** Resolve a dispatched Enter/Move against the current pool; null if it is not legal. */
export function resolveMove(state: GameState, action: MoveAction): Move | null {
  if (state.phase !== 'moving' || action.seat !== state.currentSeat) return null;
  const thrown = state.pool.find((t) => t.id === action.throwId);
  if (!thrown) return null;
  return moveWith(state, action.seat, action, thrown.value);
}

/** Candidate actions for one seat and throw id: one Enter plus one Move per distinct pawn square. */
function candidates(state: GameState, seat: SeatId, throwId: number): MoveAction[] {
  const out: MoveAction[] = [{ type: 'Enter', seat, throwId }];
  const seen = new Set<number>();
  for (const pawn of pawnsOf(state, seat)) {
    if (pawn.pathIndex === null || seen.has(pawn.pathIndex)) continue;
    seen.add(pawn.pathIndex); // Pawns on one square move identically: list the lowest id only.
    out.push({ type: 'Move', seat, throwId, pawnId: pawn.id, together: false });
  }
  return out;
}

/** Every distinct legal move for the current player and pool (PRD 8.2). */
export function legalMoves(state: GameState): Move[] {
  if (state.phase !== 'moving') return [];
  const seat = state.currentSeat;
  const moves: Move[] = [];
  const seenValues = new Set<ThrowValue>();
  for (const thrown of state.pool) {
    if (seenValues.has(thrown.value)) continue; // Equal throws give equal moves: keep the lowest id.
    seenValues.add(thrown.value);
    for (const action of candidates(state, seat, thrown.id)) {
      const move = moveWith(state, seat, action, thrown.value);
      if (move) moves.push(move);
    }
  }
  return moves;
}

/**
 * Whether a seat could ever move with some throw, ignoring the pool and blockOnce's
 * one-turn blocks. Used to detect stalemate (R-TURN-06).
 */
export function canEverMove(state: GameState, seat: SeatId): boolean {
  return THROW_VALUES.some((value) =>
    candidates(state, seat, -1).some((action) => moveWith(state, seat, action, value) !== null),
  );
}
