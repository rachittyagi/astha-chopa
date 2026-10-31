// Stand-in for '@/store/app' in component tests: same API, in-memory storage.
import { useStore } from 'zustand';

import { memoryStore } from '@/services/storage';
import { createGameStore, type GameStore } from '@/store/game';
import { createSettingsStore, type SettingsStore } from '@/store/settings';

let seed = 100;
export const gameStore = createGameStore({ storage: memoryStore(), now: () => 1, newSeed: () => seed++ });
export const settingsStore = createSettingsStore(memoryStore());

export function useGame<T>(select: (s: GameStore) => T): T {
  return useStore(gameStore, select);
}

export function useSettings<T>(select: (s: SettingsStore) => T): T {
  return useStore(settingsStore, select);
}
