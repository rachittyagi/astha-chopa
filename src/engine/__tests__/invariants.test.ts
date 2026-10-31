import { CLASSIC, configNumber, RULE_COMBINATIONS, type RuleConfig } from '../config';
import { checkInvariants } from '../invariants';
import { legalMoves } from '../legal';
import { applyAction } from '../reducer';
import { nextRandom } from '../rng';
import { createGame } from '../setup';
import { game, place, seatsOf, withPool } from '../testing/fixtures';
import type { Action, GameState } from '../types';

const THROW: Action = { type: 'Throw', seat: 'A' };

/** Plays a whole game with seeded random choices, checking invariants after every action. */
function playChecked(seed: number, config: RuleConfig) {
  let state = createGame(seatsOf(['human', 'human', 'human', 'human']), config, seed, 'g', 0);
  let pick = seed;
  const actions: Action[] = [];
  const problems: string[] = [];
  while (state.phase !== 'finished' && state.turnNumber <= 2000) {
    let action: Action = { type: 'Throw', seat: state.currentSeat };
    if (state.phase === 'moving') {
      const moves = legalMoves(state);
      const [r, next] = nextRandom(pick);
      pick = next;
      action = moves[Math.floor(r * moves.length)]!.action;
    }
    const result = applyAction(state, action);
    if (!result.ok) throw new Error(result.error.message);
    problems.push(...checkInvariants(state, action, result.state));
    actions.push(action);
    state = result.state;
  }
  return { state, actions, problems };
}

describe('invariant checker (R-TEST-05)', () => {
  it('catches corrupted states', () => {
    const ok = game();
    const bad: GameState = {
      ...place(ok, { A0: 18, C0: 3, C1: 3 }),
      pawns: [...place(ok, { A0: 18 }).pawns.slice(0, 7)],
      phase: 'moving',
    };
    const problems = checkInvariants(ok, THROW, bad);
    expect(problems.join('\n')).toMatch(/seat C has 3 pawns/);
    expect(problems.join('\n')).toMatch(/inner ring without a hit/);
    expect(problems.join('\n')).toMatch(/moving phase with no legal move/);
  });

  it('catches opponents sharing a non-safe square and pawns leaving home', () => {
    const before = place(game(), { A0: 24 });
    const after = place(game(), { A0: 3, C0: 11 });
    const problems = checkInvariants(before, THROW, after).join('\n');
    expect(problems).toMatch(/share non-safe square/);
    expect(problems).toMatch(/A0 left home/);
  });

  it('accepts a normal state', () => {
    const state = withPool(place(game(), { A0: 1 }), [2]);
    expect(checkInvariants(state, THROW, state)).toEqual([]);
  });

  it.each([0, 37, 64, 101, 127, 150, RULE_COMBINATIONS - 1])('random play under config #%i finishes with no violations', (n) => {
    const { state, problems } = playChecked(1000 + n, configNumber(n));
    expect(problems).toEqual([]);
    expect(state.phase).toBe('finished');
  });
});

describe('replay (R-TEST-06, R-RNG-02)', () => {
  it('the same seed and action log reproduce an identical final state, for 100 seeds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { state, actions } = playChecked(seed, CLASSIC);
      let replay = createGame(seatsOf(['human', 'human', 'human', 'human']), CLASSIC, seed, 'g', 0);
      for (const action of actions) {
        const result = applyAction(replay, action);
        if (!result.ok) throw new Error(result.error.message);
        replay = result.state;
      }
      expect(replay).toEqual(state);
    }
  });
});
