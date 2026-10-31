// App preferences, stored apart from the game (R-SAVE-03).
import { createStore } from 'zustand/vanilla';

import { CLASSIC, type RuleConfig } from '@/engine';

import type { KeyValueStore } from '@/services/storage';

export const SETTINGS_KEY = 'settings.v1';

export interface Settings {
  theme: 'festive' | 'chalk' | 'wood' | 'flat';
  sound: boolean;
  haptics: boolean;
  speed: 'normal' | 'fast';
  language: 'en' | 'hi';
  /** Speak each throw's result ("It's 3", "Chamma!"). */
  callouts: boolean;
  /** Default for new games: may pawns enter the inner ring before their first hit? */
  innerRing: 'open' | 'hit';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'festive',
  sound: true,
  haptics: true,
  speed: 'normal',
  language: 'en',
  callouts: true,
  innerRing: 'open',
};

/** The rules a new game starts from: Classic, with the inner-ring default from Settings. */
export function defaultRules(settings: Pick<Settings, 'innerRing'>): RuleConfig {
  return { ...CLASSIC, noHitBehavior: settings.innerRing === 'open' ? 'free' : 'block' };
}

export interface SettingsStore extends Settings {
  loaded: boolean;
  load(): Promise<void>;
  update(patch: Partial<Settings>): void;
}

function pickSettings(value: unknown): Partial<Settings> {
  if (!value || typeof value !== 'object') return {};
  const v = value as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (v.theme === 'festive' || v.theme === 'chalk' || v.theme === 'wood' || v.theme === 'flat') out.theme = v.theme;
  if (typeof v.sound === 'boolean') out.sound = v.sound;
  if (typeof v.haptics === 'boolean') out.haptics = v.haptics;
  if (v.speed === 'normal' || v.speed === 'fast') out.speed = v.speed;
  if (v.language === 'en' || v.language === 'hi') out.language = v.language;
  if (typeof v.callouts === 'boolean') out.callouts = v.callouts;
  if (v.innerRing === 'open' || v.innerRing === 'hit') out.innerRing = v.innerRing;
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
      const { theme, sound, haptics, speed, language, callouts, innerRing } = { ...get(), ...patch };
      void storage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ theme, sound, haptics, speed, language, callouts, innerRing }),
      );
    },
  }));
}
