// Test-only deep link: astha://debug/new?seed=42 starts a fixed 2-player game (TASK-50, R-TEST-08).
import Constants from 'expo-constants';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CLASSIC } from '@/engine';
import { gameStore } from '@/store/app';
import { presetSeats } from '@/ui/setup/presets';

export function debugLinksEnabled(variant: unknown): boolean {
  return variant !== 'release';
}

export default function DebugNewGame() {
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const enabled = debugLinksEnabled(Constants.expoConfig?.extra?.variant);
  // Start once, on first render; the same seed always gives the same game.
  useState(() => {
    if (enabled) {
      gameStore.getState().startGame({ seats: presetSeats(2), config: CLASSIC }, Number(seed ?? 1) >>> 0);
    }
  });

  return <Redirect href={enabled ? '/game' : '/'} />;
}
