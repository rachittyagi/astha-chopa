import * as api from '../index';
import { legalMoves } from '../legal';
import { applyAction, LOG_LIMIT } from '../reducer';
import { game } from '../testing/fixtures';
import type { Action, GameState } from '../types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Throw when throwing, otherwise play the first legal move. */
function step(state: GameState): Action {
  if (state.phase === 'throwing') return { type: 'Throw', seat: state.currentSeat };
  const [move] = legalMoves(state);
  if (!move) throw new Error('Moving phase with no legal move');
  return move.action;
}

function play(seed: number, steps: number, freeze: boolean) {
  let state = game({ seats: ['human', 'human', 'human', 'human'], seed });
  const actions: Action[] = [];
  for (let i = 0; i < steps && state.phase !== 'finished'; i++) {
    if (freeze) deepFreeze(state);
    const action = step(state);
    const result = applyAction(state, action);
    if (!result.ok) throw new Error(result.error.message);
    actions.push(action);
    state = result.state;
  }
  return { state, actions };
}

describe('engine purity (R-TECH-03)', () => {
  it('never mutates its input, reads the clock or uses Math.random', () => {
    const random = jest.spyOn(Math, 'random');
    // eslint-disable-next-line no-restricted-globals -- spying to prove the engine never reads the clock
    const now = jest.spyOn(Date, 'now');
    expect(() => play(3, 1500, true)).not.toThrow();
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });

  it('R-RNG-02 the same seed and actions give the same game', () => {
    const a = play(11, 800, false);
    const b = play(11, 800, false);
    expect(b.state).toEqual(a.state);
    expect(b.actions).toEqual(a.actions);
  });

  it('caps the in-state log', () => {
    const { state } = play(5, 1500, false);
    expect(state.log.length).toBeLessThanOrEqual(LOG_LIMIT);
  });

  it('keeps legal moves non-empty in every moving phase', () => {
    for (const seed of [1, 2, 3]) {
      expect(() => play(seed, 1000, false)).not.toThrow();
    }
  });
});

describe('public API (PRD 8.2)', () => {
  it('exposes createGame, legalMoves, applyAction and pathFor', () => {
    expect(typeof api.createGame).toBe('function');
    expect(typeof api.legalMoves).toBe('function');
    expect(typeof api.applyAction).toBe('function');
    expect(api.pathFor('B')[0]).toEqual([2, 4]);
    expect(api.SCHEMA_VERSION).toBe(1);
  });
});
