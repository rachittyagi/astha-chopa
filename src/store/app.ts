// The app's store instances, backed by device storage. Tests build their own with the factories.
import { getLocales } from 'expo-localization';
import { useStore } from 'zustand';

import { deviceStore } from '@/services/storage';

import { createGameStore, type GameStore } from './game';
import { createSettingsStore, houseRules, type SettingsStore } from './settings';

export const settingsStore = createSettingsStore(deviceStore(), () =>
  getLocales()[0]?.languageCode === 'hi' ? 'hi' : 'en',
);

export const gameStore = createGameStore({
  storage: deviceStore(),
  now: () => Date.now(),
  newSeed: () => Math.floor(Math.random() * 0xffffffff),
  houseRules: () => houseRules(settingsStore.getState()),
});

export function useGame<T>(select: (s: GameStore) => T): T {
  return useStore(gameStore, select);
}

export function useSettings<T>(select: (s: SettingsStore) => T): T {
  return useStore(settingsStore, select);
}
