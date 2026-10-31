// The app's store instances, backed by device storage. Tests build their own with the factories.
import { useStore } from 'zustand';

import { deviceStore } from '@/services/storage';

import { createGameStore, type GameStore } from './game';
import { createSettingsStore, type SettingsStore } from './settings';

export const gameStore = createGameStore({
  storage: deviceStore(),
  now: () => Date.now(),
  newSeed: () => Math.floor(Math.random() * 0xffffffff),
});

export const settingsStore = createSettingsStore(deviceStore());

export function useGame<T>(select: (s: GameStore) => T): T {
  return useStore(gameStore, select);
}

export function useSettings<T>(select: (s: SettingsStore) => T): T {
  return useStore(settingsStore, select);
}
