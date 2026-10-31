import { HOME_INDEX, LAST_OUTER_INDEX } from './board';
import type { RuleConfig } from './config';
import type { GameState, Pawn, Seat } from './types';

/** After a stalemate, hitless players circle instead of stopping (R-TURN-06). */
export function effectiveNoHit(state: GameState): RuleConfig['noHitBehavior'] {
  const mode = state.ruleConfig.noHitBehavior;
  return state.stalemateBroken && mode === 'block' ? 'circle' : mode;
}

/**
 * Path indices a pawn visits when moved n squares, ending on its landing index,
 * or null if the move is impossible (R-MOVE-01..03).
 *
 * Under `free` any pawn may go on into the inner ring. Otherwise a player without a hit
 * cannot go past index 15: under `block` the move is illegal, under `circle` the pawn
 * wraps from 15 back to 0 and goes round again.
 */
export function walk(state: GameState, seat: Seat, pawn: Pawn, n: number): number[] | null {
  if (pawn.pathIndex === null || pawn.pathIndex === HOME_INDEX) return null;
  const mode = effectiveNoHit(state);
  const wraps = !seat.hasHit && mode !== 'free';
  const visited: number[] = [];
  let cur = pawn.pathIndex;
  for (let step = 0; step < n; step++) {
    if (wraps && cur === LAST_OUTER_INDEX) {
      if (mode === 'block') return null;
      cur = 0;
    } else {
      cur += 1;
    }
    if (cur > HOME_INDEX) return null;
    visited.push(cur);
  }
  return visited;
}
