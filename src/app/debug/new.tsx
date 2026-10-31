// Test-only deep link for UI tests (TASK-50, R-TEST-08), off in release builds:
//   astha://debug/new?seed=42                    a fixed 2-player game
//   astha://debug/new?seed=2&scenario=finish     Player 1 needs one more 2 to win
import Constants from 'expo-constants';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CLASSIC, type GameState } from '@/engine';
import { gameStore } from '@/store/app';
import { presetSeats } from '@/ui/setup/presets';

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

export default function DebugNewGame() {
  const { seed, scenario } = useLocalSearchParams<{ seed?: string; scenario?: string }>();
  const enabled = debugLinksEnabled(Constants.expoConfig?.extra?.variant);
  // Start once, on first render; the same seed always gives the same game.
  useState(() => {
    if (!enabled) return;
    const store = gameStore.getState();
    store.startGame({ seats: presetSeats(2), config: CLASSIC }, Number(seed ?? 1) >>> 0);
    const game = gameStore.getState().game;
    if (scenario === 'finish' && game) gameStore.setState({ game: nearlyFinished(game), saved: nearlyFinished(game) });
  });

  return <Redirect href={enabled ? '/game' : '/'} />;
}
