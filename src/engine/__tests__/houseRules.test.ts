import { legalMoves } from '../legal';
import { act, describeMoves, game, moveAction, pawn, place, rigged, throwOnce, withHit, withPool } from '../testing/fixtures';

describe('rethrowOnOne', () => {
  it('a 1 earns another throw when on', () => {
    const after = throwOnce(rigged(place(game({ config: { rethrowOnOne: true } }), { A0: 3 }), [1]));
    expect(after).toMatchObject({ currentSeat: 'A', phase: 'throwing' });
    expect(after.pool.map((t) => t.value)).toEqual([1]);
  });

  it('a 1 ends the throwing when off', () => {
    const after = throwOnce(rigged(place(game(), { A0: 3 }), [1]));
    expect(after).toMatchObject({ currentSeat: 'A', phase: 'moving' });
  });

  it('a 1 breaks a run of 4s and 8s, so 4, 4, 1, 4 is not three in a row', () => {
    let state = rigged(place(game({ config: { rethrowOnOne: true } }), { A0: 3 }), [4, 4, 1, 4]);
    for (let i = 0; i < 4; i++) state = throwOnce(state);
    expect(state).toMatchObject({ currentSeat: 'A', phase: 'throwing', consecutiveChammaAshta: 1 });
    expect(state.pool.map((t) => t.value)).toEqual([4, 4, 1, 4]);
  });
});

// Square (3, 4) is A index 3 and C index 11.
describe('hitNeedsEntry', () => {
  it('a hit pawn leaves the board and needs a 4 or 8 to enter again', () => {
    const state = withPool(place(game({ config: { hitNeedsEntry: true } }), { A0: 1, C0: 11 }), [2]);
    const after = act(state, moveAction(state, 'A0', 1));
    expect(pawn(after, 'C0')).toMatchObject({ pathIndex: null, progress: 0 });

    const withTwo = withPool(after, [2], 'C');
    expect(describeMoves(legalMoves(withTwo)).some((m) => m.startsWith('enter'))).toBe(false);
    const withFour = withPool(after, [4], 'C');
    expect(legalMoves(withFour).some((m) => m.action.type === 'Enter')).toBe(true);
  });

  it('works even when pawns start on the board', () => {
    const base = place(game({ config: { entryRule: 'onStart', hitNeedsEntry: true } }), { A0: 1, C0: 11 });
    const state = withPool(withHit(base, 'A'), [2]);
    const after = act(state, moveAction(state, 'A0', 1));
    expect(pawn(after, 'C0').pathIndex).toBeNull();
    const enter = legalMoves(withPool(after, [8], 'C')).find((m) => m.action.type === 'Enter');
    expect(enter).toMatchObject({ pawnIds: ['C0'], to: 0 });
  });

  it('off: a hit pawn restarts on its start square', () => {
    const state = withPool(place(game(), { A0: 1, C0: 11 }), [2]);
    expect(pawn(act(state, moveAction(state, 'A0', 1)), 'C0').pathIndex).toBe(0);
  });
});
