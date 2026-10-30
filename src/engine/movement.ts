import { HOME_INDEX, LAST_OUTER_INDEX } from './board';
import type { RuleConfig } from './config';
import type { GameState, Pawn, Seat } from './types';

/** After a stalemate, every hitless player circles regardless of the setting (R-TURN-06). */
export function effectiveNoHit(state: GameState): RuleConfig['noHitBehavior'] {
  return state.stalemateBroken ? 'circle' : state.ruleConfig.noHitBehavior;
}

/**
 * Path indices a pawn visits when moved n squares, ending on its landing index,
 * or null if the move is impossible (R-MOVE-01..03).
 *
 * A player without a hit cannot go past index 15: under `block` the move is illegal,
 * under `circle` the pawn wraps from 15 back to 0 and goes round again.
 */
export function walk(state: GameState, seat: Seat, pawn: Pawn, n: number): number[] | null {
  if (pawn.pathIndex === null || pawn.pathIndex === HOME_INDEX) return null;
  const wraps = !seat.hasHit;
  const mode = effectiveNoHit(state);
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
