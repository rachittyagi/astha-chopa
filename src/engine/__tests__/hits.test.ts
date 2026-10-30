import { legalMoves } from '../legal';
import { applyAction } from '../reducer';
import { act, describeMoves, game, moveAction, pawn, place, withHit, withPool } from '../testing/fixtures';

// Square (3, 4) is A index 3 and C index 11.
describe('hits (R-HIT-01..04)', () => {
  it('R-HIT-01/02 landing on a lone opponent sends it to its start square and unlocks the inner ring', () => {
    const state = withPool(place(game(), { A0: 1, C0: 11 }), [2]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 2:1→3 hits C0']);
    const result = applyAction(state, moveAction(state, 'A0', 1));
    if (!result.ok) throw new Error(result.error.message);
    const after = result.state;
    expect(pawn(after, 'C0')).toMatchObject({ pathIndex: 0, progress: 0 });
    expect(after.seats[0]!.hasHit).toBe(true);
    expect(result.events.map((e) => e.type)).toEqual(['PawnMoved', 'PawnHit', 'InnerRingUnlocked']);
  });

  it('R-TURN-03 the hit earns a bonus throw sequence once the pool is spent', () => {
    const state = withPool(place(game(), { A0: 1, C0: 11 }), [2, 1]);
    const afterHit = act(state, moveAction(state, 'A0', 1));
    expect(afterHit).toMatchObject({ phase: 'moving', pendingBonusThrows: 1, currentSeat: 'A' });
    const afterPool = act(afterHit, moveAction(afterHit, 'A0', 2));
    expect(afterPool).toMatchObject({
      phase: 'throwing',
      inBonusSequence: true,
      pendingBonusThrows: 0,
      currentSeat: 'A',
    });
  });

  it('R-HIT-03 only the landing square counts; passed pawns are untouched', () => {
    const state = withPool(place(game(), { A0: 1, C0: 11 }), [3]);
    const after = act(state, moveAction(state, 'A0', 1));
    expect(pawn(after, 'C0').pathIndex).toBe(11);
    expect(after.seats[0]!.hasHit).toBe(false);
  });

  it('R-HIT-04 hits happen on the inner ring too', () => {
    // Square (2, 1) is A index 17 and C index 21.
    const state = withPool(withHit(place(game(), { A0: 16, C0: 21 }), 'A', 'C'), [1]);
    const after = act(state, moveAction(state, 'A0', 1));
    expect(pawn(after, 'C0').pathIndex).toBe(0);
  });

  it('R-HIT-04 no hits on a safe square', () => {
    // C index 12 is B's start (2, 4), A index 4.
    const state = withPool(place(game(), { A0: 2, C0: 12 }), [2]);
    expect(legalMoves(state)[0]?.hits).toEqual([]);
  });

  it('R-HIT-01 a hit pawn moves again with any throw', () => {
    const state = withPool(place(game(), { C0: 0 }), [1], 'C');
    expect(describeMoves(legalMoves(state))).toEqual(['C0 1:0→1']);
  });

  it('doubles off: landing on several of one opponent\'s pawns hits them all for one bonus', () => {
    const base = place(game({ config: { doubles: false } }), { A0: 1, C0: 11, C1: 11 });
    const state = withPool(base, [2]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 2:1→3 hits C0,C1']);
    const after = act(state, moveAction(state, 'A0', 1));
    expect([pawn(after, 'C0').pathIndex, pawn(after, 'C1').pathIndex]).toEqual([0, 0]);
    expect(after).toMatchObject({ phase: 'throwing', inBonusSequence: true, pendingBonusThrows: 0 });
  });
});
