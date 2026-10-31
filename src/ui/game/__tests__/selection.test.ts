import { game, place, withDoubles, withPool } from '@/engine/testing/fixtures';
import { selectionView, tapPawn, tapThrow, tapWaiting } from '@/ui/game/selection';

describe('move selection (R-UI-02..04)', () => {
  it('R-UI-02 pre-selects the chip when the pool holds one playable value', () => {
    const state = withPool(place(game(), { A0: 1 }), [2, 2]);
    expect(selectionView(state, null, null)).toMatchObject({
      playableThrowIds: [1, 2],
      activeThrowId: 1,
      movablePawnIds: ['A0'],
    });
  });

  it('waits for a chip when values differ, then highlights only pawns with a move', () => {
    const state = withPool(place(game(), { A0: 13, A1: 3 }), [3, 1]);
    expect(selectionView(state, null, null)).toMatchObject({ activeThrowId: null, movablePawnIds: ['A0', 'A1'] });
    // A 3 would take A0 past 15 without a hit (block).
    expect(selectionView(state, 1, null).movablePawnIds).toEqual(['A1']);
  });

  it('R-UI-03 chip then pawn moves the pawn, and the preview shows the path', () => {
    const state = withPool(place(game(), { A0: 1 }), [2, 1]);
    expect(selectionView(state, 1, 'A0').preview).toEqual([[4, 4], [3, 4]]);
    expect(tapPawn(state, 1, 'A0')).toEqual({
      kind: 'move',
      action: { type: 'Move', seat: 'A', throwId: 1, pawnId: 'A0', together: false },
    });
  });

  it('R-UI-03 pawn then chip works too', () => {
    const state = withPool(place(game(), { A0: 1 }), [2, 1]);
    expect(tapPawn(state, null, 'A0')).toEqual({ kind: 'selectPawn', pawnId: 'A0' });
    expect(tapThrow(state, 2, 'A0')).toMatchObject({ kind: 'move', action: { throwId: 2, pawnId: 'A0' } });
  });

  it('a chip with no pawn selected just selects the chip; unplayable chips do nothing', () => {
    const state = withPool(place(game(), { A0: 13 }), [3, 1]);
    expect(tapThrow(state, 2, null)).toEqual({ kind: 'selectThrow', throwId: 2 });
    expect(tapThrow(state, 1, null)).toEqual({ kind: 'none' });
    expect(tapThrow(state, 99, null)).toEqual({ kind: 'none' });
  });

  it('R-UI-04 a pawn in a double asks Move one or Move both', () => {
    const state = withPool(withDoubles(place(game(), { A0: 3, A1: 3 })), [2]);
    const outcome = tapPawn(state, null, 'A1');
    expect(outcome).toMatchObject({
      kind: 'choose',
      one: { pawnId: 'A1', together: false },
      both: { pawnId: 'A1', together: true },
    });
  });

  it('only the current player\'s pawns respond (R-LOCAL-03)', () => {
    const state = withPool(place(game(), { A0: 1, C0: 1 }), [2]);
    expect(tapPawn(state, null, 'C0')).toEqual({ kind: 'none' });
    expect(selectionView(state, null, null).movablePawnIds).toEqual(['A0']);
  });

  it('the waiting area enters a pawn with a 4 or 8', () => {
    const state = withPool(game(), [4, 2]);
    expect(selectionView(state, null, null).canEnter).toBe(true);
    expect(tapWaiting(state, null)).toEqual({ kind: 'move', action: { type: 'Enter', seat: 'A', throwId: 1 } });
    expect(tapWaiting(withPool(game(), [2]), null)).toEqual({ kind: 'none' });
  });

  it('with both 4 and 8 in the pool the player picks a chip before entering', () => {
    const state = withPool(game(), [4, 8, 1]);
    expect(tapWaiting(state, null)).toEqual({ kind: 'none' });
    expect(tapWaiting(state, 2)).toMatchObject({ kind: 'move', action: { type: 'Enter', throwId: 2 } });
  });
});
