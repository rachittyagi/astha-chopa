// Helpers for the test-only deep link at src/app/debug/new.tsx (TASK-50, R-TEST-08).
import type { GameState } from '@/engine';

export function debugLinksEnabled(variant: unknown): boolean {
  return variant !== 'release';
}

/** Player 1 has three pawns home and the fourth two squares away, with the inner ring open. */
export function nearlyFinished(state: GameState): GameState {
  const spots: Record<string, number> = { A0: 24, A1: 24, A2: 24, A3: 22 };
  return {
    ...state,
    seats: state.seats.map((s) => (s.id === 'A' ? { ...s, hasHit: true } : s)),
    pawns: state.pawns.map((p) => (p.id in spots ? { ...p, pathIndex: spots[p.id]!, progress: spots[p.id]! } : p)),
  };
}
