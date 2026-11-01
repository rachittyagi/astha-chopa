import { applyAction, legalMoves, type Action, type GameState } from '@/engine';
import { GAME_KEY, loadGame, loadSetup, parseSavedGame, parseSetup, saveGame, saveSetup, SETUP_KEY } from '@/services/persistence';
import { CLASSIC } from '@/engine';
import { game, seatsOf } from '@/engine/testing/fixtures';
import { memoryStore } from '@/services/storage';

function step(state: GameState): Action {
  if (state.phase === 'throwing') return { type: 'Throw', seat: state.currentSeat };
  return legalMoves(state)[0]!.action;
}

describe('persistence (R-SAVE-01..04)', () => {
  it('R-TEST-07 restores exactly what was saved after any action', async () => {
    const store = memoryStore();
    let state = game({ seats: ['human', 'bot', 'human', 'bot'], seed: 4 });
    for (let i = 0; i < 300 && state.phase !== 'finished'; i++) {
      const result = applyAction(state, step(state));
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
      await saveGame(store, state);
      const loaded = await loadGame(store);
      expect(loaded).toEqual({ status: 'ok', state });
    }
  });

  it('reports no save when the slot is empty', async () => {
    expect(await loadGame(memoryStore())).toEqual({ status: 'none' });
  });

  it('R-SAVE-04 discards an unreadable save instead of crashing', async () => {
    const store = memoryStore({ [GAME_KEY]: '{not json' });
    expect(await loadGame(store)).toEqual({ status: 'discarded', reason: 'unreadable' });
    expect(store.data[GAME_KEY]).toBeUndefined();
  });

  it('R-SAVE-04 discards a save from another schema version', () => {
    const old = JSON.stringify({ ...game(), schemaVersion: 0 });
    expect(parseSavedGame(old)).toEqual({ status: 'discarded', reason: 'oldVersion' });
  });

  it('rejects data with the right version but the wrong shape', () => {
    expect(parseSavedGame(JSON.stringify({ schemaVersion: 1, seats: [] }))).toMatchObject({ status: 'discarded' });
    expect(parseSavedGame('null')).toMatchObject({ status: 'discarded' });
    const badRules = { ...game(), ruleConfig: { ...game().ruleConfig, doubles: 'maybe' } };
    expect(parseSavedGame(JSON.stringify(badRules))).toMatchObject({ status: 'discarded' });
  });

  it('discards a save whose pawns or seats the board could not draw', () => {
    const base = game();
    const offBoard = { ...base, pawns: base.pawns.map((p, i) => (i === 0 ? { ...p, pathIndex: 30 } : p)) };
    const strangerSeat = { ...base, pawns: base.pawns.map((p, i) => (i === 0 ? { ...p, seat: 'E' } : p)) };
    const missingPawn = { ...base, pawns: base.pawns.slice(1) };
    const badSeat = { ...base, seats: base.seats.map((s, i) => (i === 0 ? { ...s, kind: 'ghost' } : s)) };
    const duplicateId = { ...base, pawns: base.pawns.map((p, i) => (i === 1 ? { ...p, id: base.pawns[0]!.id } : p)) };
    for (const bad of [offBoard, strangerSeat, missingPawn, badSeat, duplicateId]) {
      expect(parseSavedGame(JSON.stringify(bad))).toEqual({ status: 'discarded', reason: 'unreadable' });
    }
    expect(parseSavedGame(JSON.stringify(base))).toEqual({ status: 'ok', state: base });
  });

  it('treats a failing storage read as unreadable', async () => {
    const store = memoryStore();
    store.getItem = () => Promise.reject(new Error('disk'));
    expect(await loadGame(store)).toEqual({ status: 'discarded', reason: 'unreadable' });
  });
});

describe('remembered setup', () => {
  it('round-trips the last players and rules', async () => {
    const store = memoryStore();
    const setup = { seats: seatsOf(['human', 'bot', 'empty', 'empty']), config: CLASSIC };
    await saveSetup(store, setup);
    expect(await loadSetup(store)).toEqual(setup);
  });

  it('ignores a missing, corrupt or invalid setup', async () => {
    expect(await loadSetup(memoryStore())).toBeNull();
    expect(parseSetup('{oops')).toBeNull();
    expect(parseSetup(JSON.stringify({ seats: seatsOf(['bot', 'bot', 'empty', 'empty']), config: CLASSIC }))).toBeNull();
    expect(parseSetup(JSON.stringify({ seats: seatsOf(['human', 'bot', 'empty', 'empty']), config: { nope: 1 } }))).toBeNull();
    expect(await loadSetup(memoryStore({ [SETUP_KEY]: 'garbage' }))).toBeNull();
  });
});
