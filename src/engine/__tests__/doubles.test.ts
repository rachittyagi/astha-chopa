import { legalMoves } from '../legal';
import { applyAction } from '../reducer';
import {
  act,
  describeMoves,
  game,
  moveAction,
  pawn,
  place,
  withDoubles,
  withHit,
  withPool,
  withPrevTurnStart,
} from '../testing/fixtures';
import type { Action, GameState } from '../types';

const together = (state: GameState, pawnId: string, throwId: number): Action => ({
  type: 'Move',
  seat: state.currentSeat,
  throwId,
  pawnId,
  together: true,
});

function events(state: GameState, action: Action) {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.error.message);
  return { state: result.state, types: result.events.map((e) => e.type) };
}

// Square (3, 4) = A index 3; (1, 4) = A index 5 = C index 13; (2, 1) = A index 17 = C index 21.
describe('doubles (R-DBL-01..05, R-CFG-04)', () => {
  it('R-DBL-01 two pawns of one player on a non-safe square form a double', () => {
    const state = withPool(place(game(), { A0: 1, A1: 3 }), [2, 1]);
    const { state: after, types } = events(state, moveAction(state, 'A0', 1));
    expect(types).toContain('DoubleFormed');
    expect(after.doubles).toEqual([{ owner: 'A', square: [3, 4], pawnIds: ['A0', 'A1'], formedAtTurn: 1 }]);
  });

  it('pawns sharing a safe square are not a double', () => {
    const state = withPool(place(game({ config: { entryRule: 'onStart' } }), {}), [1]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 1:0→1']);
    expect(state.doubles).toEqual([]);
  });

  it('R-CFG-04 a pawn joining a double makes it a new double', () => {
    const base = withDoubles(place(game(), { A0: 3, A1: 3, A2: 1 }), 1);
    const state = withPool({ ...base, turnNumber: 5, turnStartedAt: 5 }, [2, 1]);
    const { state: after, types } = events(state, moveAction(state, 'A2', 1));
    expect(types).not.toContain('DoubleFormed');
    expect(after.doubles).toEqual([
      { owner: 'A', square: [3, 4], pawnIds: ['A0', 'A1', 'A2'], formedAtTurn: 5 },
    ]);
  });

  it('R-DBL-03 moving one pawn out breaks the double', () => {
    const state = withPool(withDoubles(place(game(), { A0: 3, A1: 3 })), [1, 3]);
    const { state: after, types } = events(state, moveAction(state, 'A0', 1));
    expect(types).toContain('DoubleBroken');
    expect(after.doubles).toEqual([]);
  });

  it('R-DBL-03 a double can move together and lands as a double', () => {
    const state = withPool(withDoubles(place(game(), { A0: 3, A1: 3 })), [2, 1]);
    expect(describeMoves(legalMoves(state))).toContain('A0+A1 2:3→5');
    const { state: after, types } = events(state, together(state, 'A1', 1));
    expect([pawn(after, 'A0'), pawn(after, 'A1')].map((p) => [p.pathIndex, p.progress])).toEqual([
      [5, 5],
      [5, 5],
    ]);
    expect(types).toEqual(['PawnMoved', 'DoubleFormed', 'DoubleBroken']);
    expect(after.doubles.map((d) => d.square)).toEqual([[1, 4]]);
  });

  it('R-DBL-04 a double landing on a lone opponent hits it, for one bonus', () => {
    const state = withPool(withDoubles(place(game(), { A0: 3, A1: 3, C0: 13 })), [2]);
    const after = act(state, together(state, 'A0', 1));
    expect(pawn(after, 'C0').pathIndex).toBe(0);
    expect(after).toMatchObject({ phase: 'throwing', inBonusSequence: true, pendingBonusThrows: 0 });
  });

  it('R-DBL-04 nothing lands on an opponent double', () => {
    const state = withPool(withDoubles(place(game(), { A0: 3, A1: 3, C0: 13, C1: 13 })), [2]);
    expect(describeMoves(legalMoves(state))).toEqual([]);
  });

  describe('R-DBL-02 blockOnce', () => {
    const blocked = () =>
      withPool(withDoubles(place(game(), { A0: 3, C0: 13, C1: 13 }), 3), [3]);

    it('stops an opponent passing on its first turn after the double formed', () => {
      expect(legalMoves(withPrevTurnStart(blocked(), 'A', 1))).toEqual([]);
    });

    it('lets the opponent pass from its next turn', () => {
      const state = withPrevTurnStart(blocked(), 'A', 4);
      expect(describeMoves(legalMoves(state))).toEqual(['A0 3:3→6']);
    });

    it('free crossing never blocks', () => {
      const base = place(game({ config: { doubleCrossing: 'free' } }), { A0: 3, C0: 13, C1: 13 });
      const state = withPool(withDoubles(base, 3), [3]);
      expect(describeMoves(legalMoves(state))).toEqual(['A0 3:3→6']);
    });

    it('also stops a double moving together', () => {
      const base = withDoubles(place(game(), { A0: 3, A1: 3, C0: 13, C1: 13 }), 3);
      expect(legalMoves(withPool(base, [3]))).toEqual([]);
    });
  });

  it('R-DBL-05 inner-ring doubles can be passed but not landed on', () => {
    const base = withHit(withDoubles(place(game(), { A0: 16, C0: 21, C1: 21 }), 3), 'A', 'C');
    expect(describeMoves(legalMoves(withPool(base, [2])))).toEqual(['A0 2:16→18']);
    expect(legalMoves(withPool(base, [1]))).toEqual([]);
  });

  it('R-DBL-05 inner-ring doubles can move together', () => {
    const state = withPool(withHit(withDoubles(place(game(), { A0: 17, A1: 17 })), 'A'), [1]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 1:17→18', 'A0+A1 1:17→18']);
  });

  it('doubles off: stacks never block, move together or get recorded', () => {
    const config = { doubles: false };
    const state = withPool(withDoubles(place(game({ config }), { A0: 3, A1: 3, C0: 13, C1: 13 }), 3), [3]);
    expect(state.doubles).toEqual([]);
    expect(describeMoves(legalMoves(state))).toEqual(['A0 3:3→6']);
    const landing = withPool(place(game({ config }), { A0: 3, C0: 13, C1: 13 }), [2]);
    expect(describeMoves(legalMoves(landing))).toEqual(['A0 2:3→5 hits C0,C1']);
  });
});
