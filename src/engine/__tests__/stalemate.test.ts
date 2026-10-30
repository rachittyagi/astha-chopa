import { legalMoves } from '../legal';
import { applyAction } from '../reducer';
import { describeMoves, game, place, rigged, throwOnce } from '../testing/fixtures';

const allAt15 = { A0: 15, A1: 15, A2: 15, A3: 15, C0: 15, C1: 15, C2: 15, C3: 15 };

describe('stalemate (R-TURN-06)', () => {
  it('when nobody can ever move, hitless players switch to circle', () => {
    const state = rigged(place(game(), allAt15), [2]);
    const result = applyAction(state, { type: 'Throw', seat: 'A' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.map((e) => e.type)).toEqual([
      'ThrowResolved',
      'PoolDiscarded',
      'TurnPassed',
      'StalemateBroken',
    ]);
    expect(result.state.stalemateBroken).toBe(true);

    const cTurn = throwOnce(rigged(result.state, [1]));
    expect(describeMoves(legalMoves(cTurn))).toEqual(['C0 1:15→0']);
  });

  it('is not declared while a waiting pawn can still enter', () => {
    const state = rigged(place(game(), { ...allAt15, A3: null }), [2]);
    const after = throwOnce(state);
    expect(after.stalemateBroken).toBe(false);
  });

  it('is not declared while a player with a hit can still move', () => {
    const base = place(game(), { ...allAt15, C0: 20 });
    const state = rigged({ ...base, seats: base.seats.map((s) => ({ ...s, hasHit: s.id === 'C' })) }, [2]);
    expect(throwOnce(state).stalemateBroken).toBe(false);
  });
});
