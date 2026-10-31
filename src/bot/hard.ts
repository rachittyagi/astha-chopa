import { HOME_INDEX, type GameState, type Move } from '../engine';
import { hitChance, threatChance } from './danger';
import { rankMoves, scoreMove, type Scored } from './medium';
import { HARD_BEAM, HARD_MAX_POOL, HARD_THREAT, WEIGHTS } from './weights';

/**
 * Medium's score, with the danger term widened to every pawn the player has on the board:
 * the expected loss from all opponents' next throws, weighted by the throw odds.
 */
export function scoreHard(before: GameState, move: Move, after: GameState): number {
  const seat = before.currentSeat;
  let score = scoreMove(before, move, after);
  for (const pawn of after.pawns) {
    if (pawn.seat !== seat || move.pawnIds.includes(pawn.id)) continue;
    if (pawn.pathIndex === null || pawn.pathIndex === HOME_INDEX) continue;
    score -= hitChance(after, pawn.id) * (WEIGHTS.danger + WEIGHTS.hitProgress * pawn.pathIndex);
  }
  score += threatChance(after, seat) * HARD_THREAT;
  return score;
}

/** Best total score reachable by spending the rest of the pool, `depth` moves deep. */
function bestContinuation(state: GameState, seat: string, depth: number): number {
  if (depth === 0 || state.phase !== 'moving' || state.currentSeat !== seat) return 0;
  const options = rankMoves(state, scoreHard).slice(0, HARD_BEAM);
  let best = 0;
  for (const option of options) {
    best = Math.max(best, option.score + bestContinuation(option.after, seat, depth - 1));
  }
  return best;
}

/**
 * Hard: one-turn danger lookahead on every pawn, and for small pools a search over the
 * order the throws are spent, playing the first step of the best sequence (R-BOT-03).
 */
export function chooseHard(state: GameState): Move {
  const ranked = rankMoves(state, scoreHard);
  const [first] = ranked;
  if (!first) throw new Error('No legal move to choose');
  if (state.pool.length <= 1 || state.pool.length > HARD_MAX_POOL) return first.move;

  let best: Scored = first;
  let bestTotal = -Infinity;
  for (const option of ranked.slice(0, HARD_BEAM)) {
    const total = option.score + bestContinuation(option.after, state.currentSeat, state.pool.length - 1);
    if (total > bestTotal) {
      bestTotal = total;
      best = option;
    }
  }
  return best.move;
}
