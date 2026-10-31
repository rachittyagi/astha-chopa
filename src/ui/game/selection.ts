// What the current player may tap, and what a tap does (R-UI-02..04). Pure: built on legalMoves().
import { legalMoves, pathFor, squareOf, type Action, type GameState, type Move, type Square } from '@/engine';

type MoveAction = Extract<Action, { type: 'Enter' | 'Move' }>;

export interface SelectionView {
  /** Pool chips that have at least one legal move. */
  playableThrowIds: number[];
  /** The selected chip, or the only playable value when the pool holds one (R-UI-02). */
  activeThrowId: number | null;
  /** Pawns that may move with the active throw, or with any throw when none is active. */
  movablePawnIds: string[];
  /** The waiting area accepts a tap: a 4 or 8 can enter a pawn. */
  canEnter: boolean;
  /** Squares the selected pawn would visit with the active throw (R-UI-03 preview). */
  preview: Square[] | null;
}

export type TapOutcome =
  | { kind: 'move'; action: MoveAction }
  /** The pawn stands in a double: ask "Move one" or "Move both" (R-UI-04). */
  | { kind: 'choose'; one: MoveAction; both: MoveAction }
  | { kind: 'selectPawn'; pawnId: string }
  | { kind: 'selectThrow'; throwId: number }
  | { kind: 'none' };

const sameSquare = (a: Square | null, b: Square | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

function valueOf(state: GameState, throwId: number | null) {
  return state.pool.find((t) => t.id === throwId)?.value;
}

/** Legal moves for a pawn's square (any pawn on it moves the same way). */
function movesForPawn(state: GameState, moves: Move[], pawnId: string): Move[] {
  const pawn = state.pawns.find((p) => p.id === pawnId);
  if (!pawn || pawn.seat !== state.currentSeat) return [];
  const square = squareOf(pawn);
  const path = pathFor(pawn.seat);
  return moves.filter(
    (m) => m.action.type === 'Move' && m.from !== null && sameSquare(path[m.from] ?? null, square),
  );
}

function withIds(move: Move, throwId: number, pawnId?: string): MoveAction {
  return move.action.type === 'Enter'
    ? { ...move.action, throwId }
    : { ...move.action, throwId, pawnId: pawnId ?? move.action.pawnId };
}

function activeThrow(state: GameState, moves: Move[], selected: number | null): number | null {
  if (selected !== null && state.pool.some((t) => t.id === selected)) return selected;
  const values = [...new Set(moves.map((m) => m.value))];
  if (values.length !== 1) return null;
  return state.pool.find((t) => t.value === values[0])?.id ?? null;
}

export function selectionView(
  state: GameState,
  selectedThrowId: number | null,
  selectedPawnId: string | null,
): SelectionView {
  const moves = legalMoves(state);
  const active = activeThrow(state, moves, selectedThrowId);
  const value = valueOf(state, active);
  const usable = value === undefined ? moves : moves.filter((m) => m.value === value);

  const movable = state.pawns.filter(
    (p) => p.seat === state.currentSeat && movesForPawn(state, usable, p.id).length > 0,
  );
  const selectedMoves = selectedPawnId ? movesForPawn(state, usable, selectedPawnId) : [];
  const single = selectedMoves.find((m) => m.action.type === 'Move' && !m.action.together);

  return {
    playableThrowIds: state.pool
      .filter((t) => moves.some((m) => m.value === t.value))
      .map((t) => t.id),
    activeThrowId: active,
    movablePawnIds: movable.map((p) => p.id),
    canEnter: usable.some((m) => m.action.type === 'Enter'),
    preview: value !== undefined && single ? single.path : null,
  };
}

function outcomeFor(candidates: Move[], throwId: number, pawnId: string): TapOutcome {
  const one = candidates.find((m) => m.action.type === 'Move' && !m.action.together);
  const both = candidates.find((m) => m.action.type === 'Move' && m.action.together);
  if (one && both) return { kind: 'choose', one: withIds(one, throwId, pawnId), both: withIds(both, throwId, pawnId) };
  const only = one ?? both;
  return only ? { kind: 'move', action: withIds(only, throwId, pawnId) } : { kind: 'none' };
}

/** A pawn tap: move with the active throw, or select the pawn and wait for a chip. */
export function tapPawn(state: GameState, selectedThrowId: number | null, pawnId: string): TapOutcome {
  const moves = legalMoves(state);
  const active = activeThrow(state, moves, selectedThrowId);
  const forPawn = movesForPawn(state, moves, pawnId);
  if (forPawn.length === 0) return { kind: 'none' };
  if (active === null) return { kind: 'selectPawn', pawnId };
  const value = valueOf(state, active);
  return outcomeFor(forPawn.filter((m) => m.value === value), active, pawnId);
}

/** A chip tap: move the selected pawn with it, or select the chip. */
export function tapThrow(state: GameState, throwId: number, selectedPawnId: string | null): TapOutcome {
  const moves = legalMoves(state);
  const value = valueOf(state, throwId);
  if (value === undefined || !moves.some((m) => m.value === value)) return { kind: 'none' };
  if (selectedPawnId) {
    const outcome = outcomeFor(
      movesForPawn(state, moves, selectedPawnId).filter((m) => m.value === value),
      throwId,
      selectedPawnId,
    );
    if (outcome.kind !== 'none') return outcome;
  }
  return { kind: 'selectThrow', throwId };
}

/** A tap on the waiting area: enter a pawn with the active 4 or 8 (R-PATH-04). */
export function tapWaiting(state: GameState, selectedThrowId: number | null): TapOutcome {
  const moves = legalMoves(state).filter((m) => m.action.type === 'Enter');
  const active = activeThrow(state, legalMoves(state), selectedThrowId);
  const pick =
    (active !== null && moves.find((m) => m.value === valueOf(state, active))) ||
    (active === null && moves.length > 0 && new Set(moves.map((m) => m.value)).size === 1 ? moves[0] : undefined);
  if (!pick) return { kind: 'none' };
  const throwId = active ?? state.pool.find((t) => t.value === pick.value)!.id;
  return { kind: 'move', action: withIds(pick, throwId) };
}
