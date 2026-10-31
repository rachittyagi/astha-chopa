import { CLASSIC, legalMoves, type GameState } from '@/engine';
import { seatsOf } from '@/engine/testing/fixtures';
import { GAME_KEY } from '@/services/persistence';
import { memoryStore } from '@/services/storage';
import { createGameStore, type GameSetup } from '@/store/game';

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(kinds: Parameters<typeof seatsOf>[0]): GameSetup {
  return { seats: seatsOf(kinds), config: CLASSIC };
}

function makeStore(storage = memoryStore()) {
  let seed = 10;
  return { storage, store: createGameStore({ storage, now: () => 1_000, newSeed: () => seed++ }) };
}

/** Plays the human seat with the first legal move and lets bots play themselves. */
function playToEnd(store: ReturnType<typeof makeStore>['store']) {
  let botTurns = 0;
  for (let i = 0; i < 20_000; i++) {
    const game = store.getState().game as GameState;
    if (game.phase === 'finished') return botTurns;
    const seat = game.seats.find((s) => s.id === game.currentSeat)!;
    if (seat.kind === 'bot') {
      botTurns++;
      expect(store.getState().playBot(game.botRngState)).toBeNull();
    } else if (game.phase === 'throwing') {
      expect(store.getState().dispatch({ type: 'Throw', seat: seat.id })).toBeNull();
    } else {
      expect(store.getState().dispatch(legalMoves(game)[0]!.action)).toBeNull();
    }
  }
  throw new Error('game did not finish');
}

describe('game store (DES-12)', () => {
  it('starts a game and saves it straight away', async () => {
    const { store, storage } = makeStore();
    store.getState().startGame(setup(['human', 'empty', 'bot', 'empty']));
    await flush();
    expect(store.getState().game).toMatchObject({ seed: 10, createdAt: 1_000, currentSeat: 'A' });
    expect(storage.data[GAME_KEY]).toBeDefined();
  });

  it('saves after every action and queues its events for the UI', async () => {
    const { store, storage } = makeStore();
    store.getState().startGame(setup(['human', 'empty', 'human', 'empty']));
    store.getState().dispatch({ type: 'Throw', seat: 'A' });
    await flush();
    expect(JSON.parse(storage.data[GAME_KEY]!)).toEqual(store.getState().game);
    expect(store.getState().events[0]).toMatchObject({ type: 'ThrowResolved', seat: 'A' });
    store.getState().consumeEvents(1);
    expect(store.getState().events[0]?.type).not.toBe('ThrowResolved');
  });

  it('returns engine errors without changing anything', () => {
    const { store } = makeStore();
    store.getState().startGame(setup(['human', 'empty', 'human', 'empty']));
    const before = store.getState().game;
    expect(store.getState().dispatch({ type: 'Throw', seat: 'C' })).toMatchObject({ type: 'NotYourTurn' });
    expect(store.getState().game).toBe(before);
  });

  it('TASK-40 bots play their own turns; a finished game frees the save slot', async () => {
    const { store, storage } = makeStore();
    store.getState().startGame(setup(['human', 'empty', 'bot', 'empty']));
    expect(playToEnd(store)).toBeGreaterThan(10);
    await flush();
    expect(store.getState().game?.phase).toBe('finished');
    expect(storage.data[GAME_KEY]).toBeUndefined();
    expect(store.getState().saved).toBeNull();
  });

  it('playBot does nothing on a human turn', () => {
    const { store } = makeStore();
    store.getState().startGame(setup(['human', 'empty', 'bot', 'empty']));
    const before = store.getState().game;
    expect(store.getState().playBot(123)).toBeNull();
    expect(store.getState().game).toBe(before);
  });

  it('finds a saved game at launch and resumes it exactly (R-SAVE-02)', async () => {
    const first = makeStore();
    first.store.getState().startGame(setup(['human', 'empty', 'bot', 'empty']));
    first.store.getState().dispatch({ type: 'Throw', seat: 'A' });
    await flush();

    const relaunch = makeStore(first.storage);
    expect(await relaunch.store.getState().loadSaved()).toMatchObject({ status: 'ok' });
    expect(relaunch.store.getState().resume()).toBe(true);
    expect(relaunch.store.getState().game).toEqual(first.store.getState().game);
    expect(relaunch.store.getState().setup?.seats[2]).toMatchObject({ kind: 'bot', botLevel: 'medium' });
  });

  it('reports and clears an unreadable save', async () => {
    const { store, storage } = makeStore(memoryStore({ [GAME_KEY]: 'garbage' }));
    await store.getState().loadSaved();
    expect(store.getState()).toMatchObject({ saved: null, saveProblem: 'unreadable' });
    expect(storage.data[GAME_KEY]).toBeUndefined();
    store.getState().dismissSaveProblem();
    expect(store.getState().saveProblem).toBeNull();
    expect(store.getState().resume()).toBe(false);
  });

  it('TASK-49 End now finishes a game once only bots are left', () => {
    const { store } = makeStore();
    store.getState().startGame(setup(['human', 'bot', 'bot', 'empty']));
    expect(store.getState().endNow()).toMatchObject({ type: 'WrongPhase' });
    const game = store.getState().game!;
    store.setState({
      game: { ...game, seats: game.seats.map((s) => (s.id === 'A' ? { ...s, finishedRank: 1 } : s)), rankings: ['A'] },
    });
    expect(store.getState().endNow()).toBeNull();
    expect(store.getState().game?.rankings).toHaveLength(3);
  });

  it('quit leaves the save in place', async () => {
    const { store, storage } = makeStore();
    store.getState().startGame(setup(['human', 'empty', 'human', 'empty']));
    store.getState().quit();
    await flush();
    expect(store.getState().game).toBeNull();
    expect(storage.data[GAME_KEY]).toBeDefined();
  });
});
