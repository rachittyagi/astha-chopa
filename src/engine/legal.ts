import { isSafe, sameSquare, squareAt, startSquare } from './board';
import { blockedByDouble } from './doubles';
import { walk } from './movement';
import { pawnsAt, pawnsOf, seatOf, squareOf } from './occupancy';
import { isExtraThrow, THROW_VALUES } from './throws';
import type { Action, GameState, Move, Pawn, SeatId, Square, ThrowValue } from './types';

type MoveAction = Extract<Action, { type: 'Enter' | 'Move' }>;

/** The lowest-id waiting pawn, which an Enter places on the start square (R-PATH-04). */
function waitingPawn(state: GameState, seat: SeatId): Pawn | undefined {
  return pawnsOf(state, seat).find((p) => p.pathIndex === null);
}

/** The other pawn that moves with `pawn` when its double moves together (R-DBL-03), if any. */
function doublePartner(state: GameState, pawn: Pawn): Pawn | undefined {
  const square = squareOf(pawn);
  if (!state.ruleConfig.doubles || !square || isSafe(square)) return undefined;
  return pawnsAt(state, square).find((p) => p.seat === pawn.seat && p.id !== pawn.id);
}

/**
 * Outcome of landing on a square: the opponent pawns hit, or null if landing is not allowed.
 * Nobody lands on an opponent's double, on either ring (R-MOVE-04, R-DBL-04, R-DBL-05);
 * no hits on safe squares (R-MOVE-05, R-HIT-04).
 */
function landing(state: GameState, seat: SeatId, square: Square): string[] | null {
  if (isSafe(square)) return [];
  const opponents = pawnsAt(state, square).filter((p) => p.seat !== seat);
  if (opponents.length === 0) return [];
  if (state.ruleConfig.doubles) {
    return opponents.length === 1 ? [opponents[0]!.id] : null;
  }
  // Doubles off: every opponent pawn on the square is hit.
  return opponents.map((p) => p.id);
}

interface MoveOptions {
  /** Skip blockOnce's one-turn blocks (stalemate detection, R-TURN-06). */
  ignoreBlocks?: boolean;
}

/** The move a seat could make with a throw value, independent of the pool. */
function moveWith(
  state: GameState,
  seat: SeatId,
  action: MoveAction,
  value: ThrowValue,
  options: MoveOptions = {},
): Move | null {
  if (action.type === 'Enter') {
    // Waiting pawns exist under needChammaOrAshta, or after a hit under hitNeedsEntry.
    if (!isExtraThrow(value)) return null;
    const pawn = waitingPawn(state, seat);
    if (!pawn) return null;
    return { action, value, pawnIds: [pawn.id], from: null, to: 0, path: [startSquare(seat)], hits: [] };
  }

  const pawn = state.pawns.find((p) => p.id === action.pawnId);
  if (!pawn || pawn.seat !== seat) return null;
  const partner = action.together ? doublePartner(state, pawn) : undefined;
  if (action.together && !partner) return null;

  const mover = seatOf(state, seat);
  const visited = walk(state, mover, pawn, value);
  if (!visited) return null;
  const to = visited[visited.length - 1]!;
  const path = visited.map((i) => squareAt(seat, i));
  const target = path[path.length - 1]!;
  if (!options.ignoreBlocks && blockedByDouble(state, mover, path.slice(0, -1))) return null;
  const hits = landing(state, seat, target);
  if (!hits) return null;
  const pawnIds = partner ? [pawn.id, partner.id] : [pawn.id];
  return { action, value, pawnIds, from: pawn.pathIndex, to, path, hits };
}

/** Resolve a dispatched Enter/Move against the current pool; null if it is not legal. */
export function resolveMove(state: GameState, action: MoveAction): Move | null {
  if (state.phase !== 'moving' || action.seat !== state.currentSeat) return null;
  const thrown = state.pool.find((t) => t.id === action.throwId);
  if (!thrown) return null;
  return moveWith(state, action.seat, action, thrown.value);
}

/**
 * Candidate actions for one seat and throw id: one Enter, plus per distinct pawn square
 * a single move and, for a double, a move-together.
 */
function candidates(state: GameState, seat: SeatId, throwId: number): MoveAction[] {
  const out: MoveAction[] = [{ type: 'Enter', seat, throwId }];
  const seen: Square[] = [];
  for (const pawn of pawnsOf(state, seat)) {
    const square = squareOf(pawn);
    if (!square || seen.some((sq) => sameSquare(sq, square))) continue;
    seen.push(square); // Pawns on one square move identically: list the lowest id only.
    out.push({ type: 'Move', seat, throwId, pawnId: pawn.id, together: false });
    if (doublePartner(state, pawn)) {
      out.push({ type: 'Move', seat, throwId, pawnId: pawn.id, together: true });
    }
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
 * Every move a seat could make with one throw of `value`, whatever the pool holds.
 * Bots use it to ask what an opponent could do next turn.
 */
export function movesWithValue(state: GameState, seat: SeatId, value: ThrowValue): Move[] {
  return candidates(state, seat, -1)
    .map((action) => moveWith(state, seat, action, value))
    .filter((m): m is Move => m !== null);
}

/**
 * Whether a seat could ever move with some throw, ignoring the pool and blockOnce's
 * one-turn blocks. Used to detect stalemate (R-TURN-06).
 */
export function canEverMove(state: GameState, seat: SeatId): boolean {
  return THROW_VALUES.some((value) =>
    candidates(state, seat, -1).some(
      (action) => moveWith(state, seat, action, value, { ignoreBlocks: true }) !== null,
    ),
  );
}
