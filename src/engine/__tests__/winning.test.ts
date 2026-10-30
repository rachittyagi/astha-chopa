import { applyAction } from '../reducer';
import { act, game, moveAction, place, withHit, withPool } from '../testing/fixtures';
import type { GameState } from '../types';

const nearlyDone = (state: GameState) =>
  withHit(place(state, { A0: 24, A1: 24, A2: 24, A3: 22 }), 'A');

describe('finishing and winning (R-WIN-01..03, R-TURN-05)', () => {
  it('R-WIN-02 with 2 players the first to bring all pawns home wins', () => {
    const state = withPool(nearlyDone(game()), [2]);
    const result = applyAction(state, moveAction(state, 'A3', 1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.map((e) => e.type)).toEqual(['PawnMoved', 'PawnHome', 'PlayerFinished', 'GameOver']);
    expect(result.state).toMatchObject({ phase: 'finished', rankings: ['A', 'C'] });
    expect(applyAction(result.state, { type: 'Throw', seat: 'C' })).toMatchObject({
      ok: false,
      error: { type: 'WrongPhase' },
    });
  });

  it('R-WIN-03 with playToEnd, play continues and R-TURN-05 drops the rest of the pool', () => {
    const base = game({ seats: ['human', 'human', 'human', 'empty'] });
    const state = withPool(nearlyDone(base), [2, 3]);
    const result = applyAction(state, moveAction(state, 'A3', 1));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.map((e) => e.type)).toEqual([
      'PawnMoved',
      'PawnHome',
      'PlayerFinished',
      'PoolDiscarded',
      'TurnPassed',
    ]);
    expect(result.state).toMatchObject({ phase: 'throwing', currentSeat: 'B', rankings: ['A'] });
  });

  it('R-WIN-03 the last player left takes last place', () => {
    const base = game({ seats: ['human', 'human', 'human', 'empty'] });
    const aDone: GameState = {
      ...withHit(place(base, { A0: 24, A1: 24, A2: 24, A3: 24, B0: 24, B1: 24, B2: 24, B3: 22 }), 'B'),
      rankings: ['A'],
      seats: base.seats.map((s) => (s.id === 'A' ? { ...s, finishedRank: 1 } : { ...s, hasHit: s.id === 'B' })),
    };
    const state = withPool(aDone, [2], 'B');
    const after = act(state, moveAction(state, 'B3', 1));
    expect(after).toMatchObject({ phase: 'finished', rankings: ['A', 'B', 'C'] });
  });

  it('playToEnd off: the game ends at the first finisher, others ranked by progress', () => {
    const base = game({ seats: ['human', 'human', 'human', 'empty'], config: { playToEnd: false } });
    const state = withPool(place(nearlyDone(base), { B0: 3, C0: 9 }), [2]);
    const after = act(state, moveAction(state, 'A3', 1));
    expect(after).toMatchObject({ phase: 'finished', rankings: ['A', 'C', 'B'] });
  });

  it('bonusOnHome: a pawn reaching home earns a bonus sequence', () => {
    const base = withHit(place(game({ config: { bonusOnHome: true } }), { A0: 22 }), 'A');
    const state = withPool(base, [2]);
    expect(act(state, moveAction(state, 'A0', 1))).toMatchObject({
      currentSeat: 'A',
      phase: 'throwing',
      inBonusSequence: true,
    });
  });

  it('bonusOnHome off: reaching home earns nothing', () => {
    const state = withPool(withHit(place(game(), { A0: 22 }), 'A'), [2]);
    expect(act(state, moveAction(state, 'A0', 1)).currentSeat).toBe('C');
  });
});
