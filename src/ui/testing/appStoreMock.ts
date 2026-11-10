// Stand-in for '@/store/app' in component tests: same API, in-memory storage.
import { useStore } from 'zustand';

import { memoryStore } from '@/services/storage';
import { createGameStore, type GameStore } from '@/store/game';
import { createSettingsStore, houseRules, type SettingsStore } from '@/store/settings';

let seed = 100;
// A ticking clock, so each new game gets its own id as it does on a device.
let clock = 1;
export const settingsStore = createSettingsStore(memoryStore());
export const gameStore = createGameStore({
  storage: memoryStore(),
  now: () => clock++,
  newSeed: () => seed++,
  houseRules: () => houseRules(settingsStore.getState()),
});

export function useGame<T>(select: (s: GameStore) => T): T {
  return useStore(gameStore, select);
}

export function useSettings<T>(select: (s: SettingsStore) => T): T {
  return useStore(settingsStore, select);
}
