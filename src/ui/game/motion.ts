// Pawn animations come from engine events, never from diffing states (R-TECH-05, R-UI-05).
import { pathFor, type GameEvent, type SeatId, type Square } from '@/engine';

export interface Motion {
  id: number;
  kind: 'move' | 'knockback';
  pawnIds: string[];
  from: Square;
  /** Squares visited in order; the last is where the pawns end up. */
  path: Square[];
}

export interface Durations {
  stepMs: number;
  knockbackMs: number;
  shellsMs: number;
}

/** Normal speed, and Fast at about half (R-UX-04). */
export function durations(fast: boolean): Durations {
  return fast ? { stepMs: 70, knockbackMs: 160, shellsMs: 350 } : { stepMs: 140, knockbackMs: 320, shellsMs: 700 };
}

/** Square-by-square moves, then a knock-back to its start square for each hit pawn. */
export function motionsFor(events: GameEvent[], firstId: number): Motion[] {
  const motions: Motion[] = [];
  let landing: Square | null = null;
  for (const event of events) {
    if (event.type === 'PawnMoved') {
      landing = event.squares[event.squares.length - 1] ?? event.from;
      motions.push({ id: firstId + motions.length, kind: 'move', pawnIds: event.pawnIds, from: event.from, path: event.squares });
    } else if (event.type === 'PawnHit' && landing) {
      const seat = event.pawnId[0] as SeatId;
      motions.push({
        id: firstId + motions.length,
        kind: 'knockback',
        pawnIds: [event.pawnId],
        from: landing,
        path: [pathFor(seat)[0]!],
      });
    }
  }
  return motions;
}
