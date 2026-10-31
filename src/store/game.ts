// The app's game state: engine state, a queue of events for the UI, and the current selection.
import { createStore } from 'zustand/vanilla';

import { chooseAction, withBotRng } from '@/bot';
import {
  applyAction,
  createGame,
  endGameNow,
  type Action,
  type ApplyResult,
  type EngineError,
  type GameEvent,
  type GameState,
  type RuleConfig,
  type SeatConfig,
} from '@/engine';
import { clearGame, loadGame, saveGame, type LoadResult } from '@/services/persistence';
import type { KeyValueStore } from '@/services/storage';

export interface GameSetup {
  seats: SeatConfig[];
  config: RuleConfig;
}

export interface GameStoreDeps {
  storage: KeyValueStore;
  now: () => number;
  newSeed: () => number;
}

export interface GameStore {
  game: GameState | null;
  setup: GameSetup | null;
  /** Events not yet shown by the UI, oldest first (R-TECH-05). */
  events: GameEvent[];
  selectedThrowId: number | null;
  selectedPawnId: string | null;
  /** A saved game found at launch, offered as Resume. */
  saved: GameState | null;
  /** Set when a save could not be read and was removed (R-SAVE-04). */
  saveProblem: 'unreadable' | 'oldVersion' | null;

  loadSaved(): Promise<LoadResult>;
  /** Start a game; `seed` is only passed by the debug deep link. */
  startGame(setup: GameSetup, seed?: number): void;
  resume(): boolean;
  dispatch(action: Action): EngineError | null;
  /** Play the current bot's action, after advancing its stream for the delay already waited. */
  playBot(botRngState: number): EngineError | null;
  endNow(): EngineError | null;
  selectThrow(id: number | null): void;
  selectPawn(id: string | null): void;
  /** Drop the first n events once the UI has shown them. */
  consumeEvents(n: number): void;
  /** Leave the game screen; the game stays saved. */
  quit(): void;
  dismissSaveProblem(): void;
}

export function createGameStore({ storage, now, newSeed }: GameStoreDeps) {
  return createStore<GameStore>()((set, get) => {
    const commit = (result: ApplyResult): EngineError | null => {
      if (!result.ok) return result.error;
      const finished = result.state.phase === 'finished';
      set((s) => ({
        game: result.state,
        events: [...s.events, ...result.events],
        selectedThrowId: null,
        selectedPawnId: null,
        saved: finished ? null : result.state,
      }));
      // Save after every applied action; a finished game frees the slot (R-SAVE-01).
      void (finished ? clearGame(storage) : saveGame(storage, result.state));
      return null;
    };

    return {
      game: null,
      setup: null,
      events: [],
      selectedThrowId: null,
      selectedPawnId: null,
      saved: null,
      saveProblem: null,

      async loadSaved() {
        const result = await loadGame(storage);
        set({
          saved: result.status === 'ok' ? result.state : null,
          saveProblem: result.status === 'discarded' ? result.reason : null,
        });
        return result;
      },

      startGame(setup, seed) {
        const game = createGame(setup.seats, setup.config, seed ?? newSeed(), `game-${now()}`, now());
        set({ game, setup, events: [], selectedThrowId: null, selectedPawnId: null, saved: game });
        void saveGame(storage, game);
      },

      resume() {
        const { saved } = get();
        if (!saved) return false;
        const setup = {
          seats: saved.seats.map(({ kind, name, color, botLevel }) => ({
            kind,
            name,
            color,
            ...(botLevel ? { botLevel } : {}),
          })),
          config: saved.ruleConfig,
        };
        set({ game: saved, setup, events: [], selectedThrowId: null, selectedPawnId: null });
        return true;
      },

      dispatch(action) {
        const { game } = get();
        if (!game) return { type: 'WrongPhase', message: 'No game in progress.' };
        return commit(applyAction(game, action));
      },

      playBot(botRngState) {
        const { game } = get();
        if (!game || game.phase === 'finished') return null;
        const seat = game.seats.find((s) => s.id === game.currentSeat);
        if (seat?.kind !== 'bot') return null;
        const ready = withBotRng(game, botRngState);
        const decision = chooseAction(ready);
        return commit(applyAction(withBotRng(ready, decision.botRngState), decision.action));
      },

      endNow() {
        const { game } = get();
        if (!game) return { type: 'WrongPhase', message: 'No game in progress.' };
        return commit(endGameNow(game));
      },

      selectThrow: (id) => set({ selectedThrowId: id }),
      selectPawn: (id) => set({ selectedPawnId: id }),
      consumeEvents: (n) => set((s) => ({ events: s.events.slice(n) })),
      quit: () => set({ game: null, events: [], selectedThrowId: null, selectedPawnId: null }),
      dismissSaveProblem: () => set({ saveProblem: null }),
    };
  });
}

export type GameStoreApi = ReturnType<typeof createGameStore>;
