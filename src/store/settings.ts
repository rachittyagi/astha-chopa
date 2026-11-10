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
  /** House rules for every new game (set here, not per game): a 1 earns another throw. */
  rethrowOnOne: boolean;
  /** A hit pawn needs a 4 or 8 to enter again. */
  hitNeedsEntry: boolean;
  /** A pawn reaching home earns another throw. */
  bonusOnHome: boolean;
}

/** The rules Settings decides for every new game, whatever the setup chose. */
export const HOUSE_RULE_KEYS = ['rethrowOnOne', 'hitNeedsEntry', 'bonusOnHome'] as const;
export type HouseRules = Pick<RuleConfig, (typeof HOUSE_RULE_KEYS)[number]>;

export function houseRules(settings: HouseRules): HouseRules {
  return { rethrowOnOne: settings.rethrowOnOne, hitNeedsEntry: settings.hitNeedsEntry, bonusOnHome: settings.bonusOnHome };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'wood',
  sound: true,
  haptics: true,
  speed: 'normal',
  language: 'en',
  callouts: true,
  innerRing: 'open',
  rethrowOnOne: false,
  hitNeedsEntry: false,
  bonusOnHome: false,
};

/** The rules a new game starts from: Classic, with the inner ring and house rules from Settings. */
export function defaultRules(settings: Pick<Settings, 'innerRing'> & Partial<HouseRules>): RuleConfig {
  return {
    ...CLASSIC,
    noHitBehavior: settings.innerRing === 'open' ? 'free' : 'block',
    ...houseRules({ ...CLASSIC, ...settings }),
  };
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
  for (const key of HOUSE_RULE_KEYS) if (typeof v[key] === 'boolean') out[key] = v[key];
  return out;
}

/** `detectLanguage` picks the first-launch language from the device (no saved choice yet). */
export function createSettingsStore(storage: KeyValueStore, detectLanguage: () => Settings['language'] = () => 'en') {
  // Settings changed before load() finishes win over the stored ones.
  const touched = new Set<string>();
  const persist = (s: Settings) => {
    const { theme, sound, haptics, speed, language, callouts, innerRing } = s;
    const saved = { theme, sound, haptics, speed, language, callouts, innerRing, ...houseRules(s) };
    void storage.setItem(SETTINGS_KEY, JSON.stringify(saved));
  };
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
      const stored = Object.fromEntries(Object.entries(saved).filter(([key]) => !touched.has(key)));
      const language = touched.has('language') ? get().language : detectLanguage();
      set({ language, ...stored, loaded: true });
      // Early changes were held back so they could not overwrite the stored values with defaults.
      if (touched.size > 0) persist(get());
      touched.clear();
    },
    update(patch) {
      set(patch);
      if (!get().loaded) {
        Object.keys(patch).forEach((key) => touched.add(key));
        return;
      }
      persist(get());
    },
  }));
}
