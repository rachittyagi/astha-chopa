// App preferences, stored apart from the game (R-SAVE-03).
import { createStore } from 'zustand/vanilla';

import type { KeyValueStore } from '@/services/storage';

export const SETTINGS_KEY = 'settings.v1';

export interface Settings {
  theme: 'chalk' | 'wood' | 'flat';
  sound: boolean;
  haptics: boolean;
  speed: 'normal' | 'fast';
  language: 'en' | 'hi';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'chalk',
  sound: true,
  haptics: true,
  speed: 'normal',
  language: 'en',
};

export interface SettingsStore extends Settings {
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): void;
}

function pickSettings(value: unknown): Partial<Settings> {
  if (!value || typeof value !== 'object') return {};
  const v = value as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (v.theme === 'chalk' || v.theme === 'wood' || v.theme === 'flat') out.theme = v.theme;
  if (typeof v.sound === 'boolean') out.sound = v.sound;
  if (typeof v.haptics === 'boolean') out.haptics = v.haptics;
  if (v.speed === 'normal' || v.speed === 'fast') out.speed = v.speed;
  if (v.language === 'en' || v.language === 'hi') out.language = v.language;
  return out;
}

/** `detectLanguage` picks the first-launch language from the device (no saved choice yet). */
export function createSettingsStore(storage: KeyValueStore, detectLanguage: () => Settings['language'] = () => 'en') {
  return createStore<SettingsStore>()((set, get) => ({
    ...DEFAULT_SETTINGS,
    loaded: false,
    async load() {
      let saved: Partial<Settings> = {};
      try {
        saved = pickSettings(JSON.parse((await storage.getItem(SETTINGS_KEY)) ?? '{}'));
      } catch {
        saved = {};
      }
      set({ language: detectLanguage(), ...saved, loaded: true });
    },
    update(patch) {
      set(patch);
      const { theme, sound, haptics, speed, language } = { ...get(), ...patch };
      void storage.setItem(SETTINGS_KEY, JSON.stringify({ theme, sound, haptics, speed, language }));
    },
  }));
}
