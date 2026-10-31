import {
  applyAction,
  HOME_INDEX,
  isOuterSquare,
  isSafe,
  legalMoves,
  sameSquare,
  type GameState,
  type Move,
} from '../engine';
import { hitChance } from './danger';
import { WEIGHTS, type Weights } from './weights';

export interface Scored {
  move: Move;
  score: number;
  /** State after the move, for callers that look further ahead. */
  after: GameState;
}

/** The PRD's Medium heuristic for one move (section 5). */
export function scoreMove(before: GameState, move: Move, after: GameState, w: Weights = WEIGHTS): number {
  const seat = before.seats.find((s) => s.id === before.currentSeat)!;
  const moved = move.pawnIds[0]!;
  const landing = move.path[move.path.length - 1]!;
  let score = 0;

  for (const id of move.hits) {
    const victim = before.pawns.find((p) => p.id === id)!;
    score += w.hit + w.hitProgress * (victim.pathIndex ?? 0);
  }
  if (move.hits.length > 0 && !seat.hasHit) score += w.firstHit;
  if (move.to === HOME_INDEX) score += w.home;
  if (move.action.type === 'Enter') score += w.enter;
  if (move.to !== HOME_INDEX && isSafe(landing)) score += w.safe;
  if (move.from !== null && hitChance(before, moved) > 0) score += w.escape;
  if (move.to !== HOME_INDEX) score -= w.danger * hitChance(after, moved);

  const formsDouble = (state: GameState) =>
    state.doubles.some((d) => d.owner === seat.id && sameSquare(d.square, landing));
  if (isOuterSquare(landing) && formsDouble(after) && !formsDouble(before)) score += w.outerDouble;

  if (move.from !== null) score += w.progress * move.value * move.pawnIds.length;
  return score;
}

/** Furthest-along pawn first, then the lowest pawn id (R-BOT-06). */
export function tieBreak(a: Move, b: Move): number {
  return (b.from ?? -1) - (a.from ?? -1) || a.pawnIds[0]!.localeCompare(b.pawnIds[0]!);
}

export function afterMove(state: GameState, move: Move): GameState {
  const result = applyAction(state, move.action);
  if (!result.ok) throw new Error(`Bot chose an illegal move: ${result.error.message}`);
  return result.state;
}

/** Score every legal move, best first. */
export function rankMoves(
  state: GameState,
  scorer: (before: GameState, move: Move, after: GameState) => number = scoreMove,
): Scored[] {
  return legalMoves(state)
    .map((move) => {
      const after = afterMove(state, move);
      return { move, after, score: scorer(state, move, after) };
    })
    .sort((a, b) => b.score - a.score || tieBreak(a.move, b.move));
}

export function chooseMedium(state: GameState): Move {
  const [best] = rankMoves(state);
  if (!best) throw new Error('No legal move to choose');
  return best.move;
}
