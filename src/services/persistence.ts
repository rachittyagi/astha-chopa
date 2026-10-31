// One saved game slot plus separate settings (R-SAVE-01..04).
import { isValidConfig, SCHEMA_VERSION, SEAT_IDS, type GameState } from '@/engine';

import type { KeyValueStore } from './storage';

export const GAME_KEY = 'game.v1';

export type LoadResult =
  | { status: 'none' }
  | { status: 'ok'; state: GameState }
  | { status: 'discarded'; reason: 'unreadable' | 'oldVersion' };

const PHASES = ['throwing', 'moving', 'finished'];

/** A shape check on a parsed save: enough to reject corrupt or foreign data safely. */
export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<GameState>;
  return (
    typeof s.id === 'string' &&
    Array.isArray(s.seats) &&
    s.seats.length === SEAT_IDS.length &&
    Array.isArray(s.pawns) &&
    Array.isArray(s.pool) &&
    Array.isArray(s.doubles) &&
    Array.isArray(s.rankings) &&
    typeof s.rngState === 'number' &&
    typeof s.botRngState === 'number' &&
    typeof s.turnNumber === 'number' &&
    PHASES.includes(s.phase as string) &&
    SEAT_IDS.includes(s.currentSeat as never) &&
    !!s.ruleConfig &&
    isValidConfig(s.ruleConfig)
  );
}

export function parseSavedGame(json: string | null): LoadResult {
  if (json === null) return { status: 'none' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { status: 'discarded', reason: 'unreadable' };
  }
  const version = (parsed as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version === 'number' && version !== SCHEMA_VERSION) {
    return { status: 'discarded', reason: 'oldVersion' };
  }
  if (!isGameState(parsed)) return { status: 'discarded', reason: 'unreadable' };
  return { status: 'ok', state: parsed };
}

export async function saveGame(store: KeyValueStore, state: GameState): Promise<void> {
  await store.setItem(GAME_KEY, JSON.stringify(state));
}

/** Load the saved game; a bad save is removed and reported, never thrown (R-SAVE-04). */
export async function loadGame(store: KeyValueStore): Promise<LoadResult> {
  let json: string | null;
  try {
    json = await store.getItem(GAME_KEY);
  } catch {
    json = '';
  }
  const result = parseSavedGame(json);
  if (result.status === 'discarded') await store.removeItem(GAME_KEY);
  return result;
}

export async function clearGame(store: KeyValueStore): Promise<void> {
  await store.removeItem(GAME_KEY);
}
