import { applyAction } from '../reducer';
import { nextSeat } from '../turn';
import {
  act,
  game,
  moveAction,
  pawn,
  place,
  rigged,
  throwOnce,
  withPool,
} from '../testing/fixtures';
import type { GameState } from '../types';

const types = (state: GameState, from: GameState) => {
  const result = applyAction(from, { type: 'Throw', seat: from.currentSeat });
  if (!result.ok) throw new Error(result.error.message);
  expect(result.state).toEqual(state);
  return result.events.map((e) => e.type);
};

describe('throw phase (R-THROW-05, R-THROW-06)', () => {
  it('R-THROW-05 a 4 or 8 keeps throwing; a 1, 2 or 3 ends the sequence', () => {
    let state = rigged(game(), [4, 8, 2]);
    state = throwOnce(state);
    expect(state.phase).toBe('throwing');
    state = throwOnce(state);
    expect(state.phase).toBe('throwing');
    state = throwOnce(state);
    expect(state.phase).toBe('moving');
    expect(state.pool.map((t) => t.value)).toEqual([4, 8, 2]);
  });

  it('R-THROW-06 three 4/8 throws in a row forfeit the turn', () => {
    let state = rigged(game(), [4, 8, 4]);
    state = throwOnce(throwOnce(state));
    const before = state;
    state = throwOnce(state);
    expect(state).toMatchObject({ currentSeat: 'C', phase: 'throwing', pool: [] });
    expect(types(state, before)).toEqual(['ThrowResolved', 'TurnForfeited', 'TurnPassed']);
  });

  it('triplePenalty off: a fourth throw is allowed', () => {
    let state = rigged(game({ config: { triplePenalty: false } }), [4, 4, 4, 1]);
    for (let i = 0; i < 4; i++) state = throwOnce(state);
    expect(state.phase).toBe('moving');
    expect(state.pool).toHaveLength(4);
  });

  it('R-TURN-04 a triple penalty in a bonus sequence also drops queued bonuses', () => {
    let state: GameState = { ...rigged(game(), [8, 8, 8]), inBonusSequence: true, pendingBonusThrows: 2 };
    for (let i = 0; i < 3; i++) state = throwOnce(state);
    expect(state).toMatchObject({ currentSeat: 'C', pendingBonusThrows: 0, inBonusSequence: false });
  });

  it('bonus-sequence throws carry the bonus flag', () => {
    const state: GameState = { ...rigged(place(game(), { A0: 1 }), [1]), inBonusSequence: true };
    expect(throwOnce(state).pool[0]?.bonus).toBe(true);
  });
});

describe('spending the pool (R-TURN-01, R-TURN-02)', () => {
  it('R-TURN-02 with nothing playable the pool is discarded and the turn passes', () => {
    const state = rigged(game(), [2]);
    const result = applyAction(state, { type: 'Throw', seat: 'A' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.map((e) => e.type)).toEqual(['ThrowResolved', 'PoolDiscarded', 'TurnPassed']);
    expect(result.state).toMatchObject({ currentSeat: 'C', phase: 'throwing', pool: [] });
  });

  it('R-TURN-02 keeps a throw that becomes playable after another is used', () => {
    const state = withPool(game(), [3, 4]);
    const afterEnter = act(state, { type: 'Enter', seat: 'A', throwId: 2 });
    expect(afterEnter.pool.map((t) => t.value)).toEqual([3]);
    const afterMove = act(afterEnter, moveAction(afterEnter, 'A0', 1));
    expect(pawn(afterMove, 'A0').pathIndex).toBe(3);
  });

  it('R-TURN-02 discards only what is left once nothing is playable', () => {
    const state = withPool(place(game(), { A0: 13, A1: 15, A2: 15, A3: 15 }), [1, 3]);
    const result = applyAction(state, moveAction(state, 'A0', 1));
    if (!result.ok) throw new Error(result.error.message);
    const discarded = result.events.find((e) => e.type === 'PoolDiscarded');
    expect(discarded && 'throws' in discarded ? discarded.throws.map((t) => t.value) : []).toEqual([3]);
    expect(result.state.currentSeat).toBe('C');
  });

  it('R-TURN-01 throws may be spent in any order, on different pawns', () => {
    const state = withPool(place(game(), { A0: 1, A1: 5 }), [1, 2]);
    const a = act(act(state, moveAction(state, 'A1', 2)), { ...moveAction(state, 'A0', 1) });
    expect([pawn(a, 'A0').pathIndex, pawn(a, 'A1').pathIndex]).toEqual([2, 7]);
  });
});

describe('turn order (R-SEAT-03)', () => {
  it('passes A → B → D → A, skipping empty seats', () => {
    const state = game({ seats: ['human', 'human', 'empty', 'human'] });
    expect(nextSeat(state, 'A')).toBe('B');
    expect(nextSeat(state, 'B')).toBe('D');
    expect(nextSeat(state, 'D')).toBe('A');
  });

  it('skips finished seats', () => {
    const base = game({ seats: ['human', 'human', 'human', 'empty'] });
    const state = { ...base, seats: base.seats.map((s) => (s.id === 'B' ? { ...s, finishedRank: 1 } : s)) };
    expect(nextSeat(state, 'A')).toBe('C');
  });

  it('records when the outgoing seat\'s turn started (for blockOnce)', () => {
    const state = throwOnce(rigged(game(), [2]));
    expect(state.seats[0]!.prevTurnStart).toBe(1);
    expect(state).toMatchObject({ turnNumber: 2, turnStartedAt: 2 });
  });
});

describe('errors (PRD 8.2)', () => {
  it('NotYourTurn, WrongPhase and IllegalMove leave the state untouched', () => {
    const state = withPool(game(), [2]);
    const notYours = applyAction(state, { type: 'Throw', seat: 'C' });
    const wrongPhase = applyAction(state, { type: 'Throw', seat: 'A' });
    const illegal = applyAction(state, moveAction(state, 'A0', 1));
    const noThrow = applyAction(state, moveAction(state, 'A0', 9));
    const throwFirst = applyAction(game(), moveAction(game(), 'A0', 1));
    expect([notYours, wrongPhase, illegal, noThrow, throwFirst].map((r) => (r.ok ? 'ok' : r.error.type))).toEqual([
      'NotYourTurn',
      'WrongPhase',
      'IllegalMove',
      'IllegalMove',
      'WrongPhase',
    ]);
  });

  it('rejects moving an opponent\'s pawn and moving a double together (not yet supported)', () => {
    const state = withPool(place(game(), { A0: 1, A1: 1, C0: 3 }), [1]);
    expect(applyAction(state, { type: 'Move', seat: 'A', throwId: 1, pawnId: 'C0', together: false }).ok).toBe(false);
    expect(applyAction(state, { type: 'Move', seat: 'A', throwId: 1, pawnId: 'A0', together: true }).ok).toBe(false);
  });
});
