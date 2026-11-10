import '@/i18n';

import { render, screen } from '@testing-library/react-native';

import { botDelay, chooseAction, withBotRng } from '@/bot';
import { applyAction, type GameState, type Square } from '@/engine';
import { act, game, moveAction, place, withPool } from '@/engine/testing/fixtures';
import { Board } from '@/ui/game/Board';
import { botPlan, trailAfter, type TrailMark } from '@/ui/game/follow';
import { selectionView } from '@/ui/game/selection';

jest.mock('@/store/app', () => require('@/ui/testing/appStoreMock'));

/** What the game store's playBot does after the driver's delay. */
function playBot(state: GameState) {
  const ready = withBotRng(state, botDelay(state.botRngState).botRngState);
  const decision = chooseAction(ready);
  const result = applyAction(withBotRng(ready, decision.botRngState), decision.action);
  if (!result.ok) throw new Error(result.error.message);
  return { action: decision.action, state: result.state };
}

const botTurn = () =>
  withPool(place(game({ seats: ['bot', 'empty', 'human', 'empty'] }), { A0: 2, A1: 5, C0: 9 }), [8, 8, 4, 2], 'A');

describe('Following a bot turn', () => {
  it('previews the exact move the bot then plays, and numbers each one in order', () => {
    let state = botTurn();
    let trail: TrailMark[] = [];
    const values: number[] = [];
    while (state.currentSeat === 'A' && state.phase === 'moving') {
      const plan = botPlan(state)!;
      const poolBefore = state.pool;
      const played = playBot(state);
      if (played.action.type === 'Throw') throw new Error('expected a move');
      expect(plan.throwId).toBe(played.action.throwId);
      state = played.state;
      trail = trailAfter(trail, state, poolBefore);
      const mark = trail[trail.length - 1]!;
      expect(mark.to).toEqual(plan.squares[plan.squares.length - 1]);
      values.push(mark.value);
    }
    expect(trail.map((m) => m.n)).toEqual([1, 2, 3, 4]);
    expect([...values].sort()).toEqual([2, 4, 8, 8]);
  });

  it('shows no plan on a human turn', () => {
    expect(botPlan(withPool(place(game(), { A0: 2 }), [3]))).toBeNull();
  });

  it("clears the trail when the human moves, and replaces a bot's marks from an earlier turn", () => {
    const old: TrailMark = { n: 1, seat: 'A', turn: 0, value: 3, from: [4, 2], to: [4, 0], pawnIds: ['A0'] };
    const human = withPool(place(game({ seats: ['bot', 'empty', 'human', 'empty'] }), { C0: 2 }), [3], 'C');
    const after = act(human, moveAction(human, 'C0', 1));
    expect(trailAfter([old], after, human.pool)).toEqual([]);

    const bot = { ...botTurn(), turnNumber: 5 };
    const played = playBot(bot);
    const trail = trailAfter([old], played.state, bot.pool);
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({ n: 1, seat: 'A', turn: 5 });
  });

  const hidden = { includeHiddenElements: true };

  it('draws a filled badge where each pawn landed and a hollow one where it left', async () => {
    const state = place(game(), { A0: 2 });
    const from: Square = [4, 1];
    const trail: TrailMark[] = [
      { n: 1, seat: 'A', turn: 1, value: 8, from, to: [2, 0], pawnIds: ['A0'] },
      { n: 2, seat: 'A', turn: 1, value: 4, from: null, to: [4, 2], pawnIds: ['A1'] },
    ];
    await render(<Board state={state} size={300} view={selectionView(state, null, null)} onPawnPress={jest.fn()} trail={trail} />);
    expect(screen.getByTestId('trail-to-A1', hidden)).toBeTruthy();
    expect(screen.getByTestId('trail-from-A1', hidden)).toBeTruthy();
    expect(screen.getByTestId('trail-to-A2', hidden)).toBeTruthy();
    expect(screen.queryByTestId('trail-from-A2', hidden)).toBeNull();
  });

  it('holds back the landing badge until the pawn has finished moving', async () => {
    const state = place(game(), { A0: 2 });
    const trail: TrailMark[] = [
      { n: 1, seat: 'A', turn: 1, value: 8, from: [4, 2], to: [4, 1], pawnIds: ['A0'] },
      { n: 2, seat: 'A', turn: 1, value: 2, from: [4, 1], to: [4, 3], pawnIds: ['A0'] },
    ];
    const motions = [{ id: 1, kind: 'move' as const, pawnIds: ['A0'], from: [4, 1] as Square, path: [[4, 2], [4, 3]] as Square[] }];
    await render(
      <Board state={state} size={300} view={selectionView(state, null, null)} onPawnPress={jest.fn()} trail={trail} motions={motions} />,
    );
    // The pawn's earlier landing stays marked; only the move still playing waits.
    expect(screen.getByTestId('trail-to-A1', hidden)).toBeTruthy();
    expect(screen.getByTestId('trail-from-A2', hidden)).toBeTruthy();
    expect(screen.queryByTestId('trail-to-A2', hidden)).toBeNull();
  });
});
