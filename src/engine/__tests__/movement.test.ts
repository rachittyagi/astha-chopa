import { legalMoves } from '../legal';
import {
  act,
  describeMoves,
  game,
  moveAction,
  pawn,
  place,
  withHit,
  withPool,
} from '../testing/fixtures';

describe('entering pawns (R-PATH-04)', () => {
  it('a 4 or 8 enters exactly one waiting pawn onto the start square', () => {
    for (const value of [4, 8] as const) {
      const state = withPool(game(), [value]);
      expect(describeMoves(legalMoves(state))).toEqual([`enter ${value}`]);
      const after = act(state, { type: 'Enter', seat: 'A', throwId: 1 });
      expect(pawn(after, 'A0').pathIndex).toBe(0);
      expect(['A1', 'A2', 'A3'].map((id) => pawn(after, id).pathIndex)).toEqual([null, null, null]);
    }
  });

  it('1, 2 and 3 cannot enter a pawn', () => {
    for (const value of [1, 2, 3] as const) {
      expect(legalMoves(withPool(game(), [value]))).toEqual([]);
    }
  });

  it('under onStart there is no Enter move', () => {
    const state = withPool(game({ config: { entryRule: 'onStart' } }), [4]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 4:0→4']);
  });
});

describe('legal moves (R-MOVE-01..05)', () => {
  it('R-MOVE-01 home needs an exact count', () => {
    const state = withHit(place(game(), { A0: 22 }), 'A');
    expect(describeMoves(legalMoves(withPool(state, [3])))).toEqual([]);
    expect(describeMoves(legalMoves(withPool(state, [2])))).toEqual(['A0 2:22→24']);
  });

  it('R-MOVE-02/03 a player without a hit stops at index 15 (block)', () => {
    const state = place(game(), { A0: 13 });
    expect(describeMoves(legalMoves(withPool(state, [3])))).toEqual([]);
    expect(describeMoves(legalMoves(withPool(state, [2])))).toEqual(['A0 2:13→15']);
  });

  it('R-MOVE-02 after one hit, every pawn of that player may enter the inner ring', () => {
    const state = withHit(place(game(), { A0: 13, A1: 15 }), 'A');
    expect(describeMoves(legalMoves(withPool(state, [3])))).toEqual(['A0 3:13→16', 'A1 3:15→18']);
  });

  it('noHitBehavior circle: a hitless pawn wraps from 15 back round the outer ring', () => {
    const state = withPool(place(game({ config: { noHitBehavior: 'circle' } }), { A0: 14 }), [3]);
    const [move] = legalMoves(state);
    expect(move?.to).toBe(1);
    expect(move?.path).toEqual([[4, 1], [4, 2], [4, 3]]);
    const after = act(state, moveAction(state, 'A0', 1));
    expect(pawn(after, 'A0')).toMatchObject({ pathIndex: 1, progress: 17 });
  });

  it('R-MOVE-04 a single pawn may not land on an opponent double', () => {
    // C index 10 is square (4, 4), which is A index 2.
    const state = place(game(), { A0: 1, C0: 10, C1: 10 });
    expect(describeMoves(legalMoves(withPool(state, [1])))).toEqual([]);
  });

  it('R-MOVE-05 any pawns may share a safe square, without hits', () => {
    // C index 12 is square (2, 4), B's start (A index 4).
    const state = withPool(place(game(), { A0: 2, C0: 12 }), [2]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 2:2→4']);
    const after = act(state, moveAction(state, 'A0', 1));
    expect(pawn(after, 'C0').pathIndex).toBe(12);
  });

  it('lists equivalent moves once: same value, same square', () => {
    const state = withPool(place(game(), { A0: 3, A1: 3 }), [2, 2]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 2:3→5', 'A0+A1 2:3→5']);
    expect(legalMoves(state)[0]?.action.throwId).toBe(1);
  });

  it('a pawn at home never moves again (R-WIN-01)', () => {
    const state = withHit(place(game(), { A0: 24, A1: 20 }), 'A');
    expect(describeMoves(legalMoves(withPool(state, [1])))).toEqual(['A1 1:20→21']);
  });

  it('accepts any throw id or stacked pawn id for an equivalent move', () => {
    const state = withPool(place(game(), { A0: 3, A1: 3 }), [2, 2]);
    const after = act(state, moveAction(state, 'A1', 2));
    expect(pawn(after, 'A1').pathIndex).toBe(5);
    expect(after.pool.map((t) => t.id)).toEqual([1]);
  });
});
