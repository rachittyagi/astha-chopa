// Checks the assumptions the Maestro flows in .maestro/ rely on, without a device.
import '@/i18n';

import { CLASSIC, legalMoves } from '@/engine';
import { memoryStore } from '@/services/storage';
import { createGameStore } from '@/store/game';
import { presetSeats } from '@/ui/setup/presets';

import { debugLinksEnabled, nearlyFinished } from '../../app/debug/new';

jest.mock('expo-constants', () => ({ expoConfig: { extra: { variant: 'development' } } }));
jest.mock('@/store/app', () => require('@/ui/testing/appStoreMock'));

function seededStore(seed: number) {
  const store = createGameStore({ storage: memoryStore(), now: () => 1, newSeed: () => 0 });
  store.getState().startGame({ seats: presetSeats(2), config: CLASSIC }, seed);
  return store;
}

describe('Maestro flow assumptions (TASK-63)', () => {
  it('debug links are off only in release builds', () => {
    expect(debugLinksEnabled('release')).toBe(false);
    expect(debugLinksEnabled('preview')).toBe(true);
    expect(debugLinksEnabled(undefined)).toBe(true);
  });

  it('new-2p-turn / background-resume: seed 61 throws 8 then 3; the pawn ends on square 4', () => {
    const store = seededStore(61);
    store.getState().dispatch({ type: 'Throw', seat: 'A' });
    store.getState().dispatch({ type: 'Throw', seat: 'A' });
    expect(store.getState().game?.pool.map((t) => t.value)).toEqual([8, 3]);
    store.getState().dispatch({ type: 'Enter', seat: 'A', throwId: 1 });
    expect(store.getState().game?.pool.map((t) => t.value)).toEqual([3]);
    store.getState().dispatch(legalMoves(store.getState().game!)[0]!.action);
    const game = store.getState().game!;
    expect(game.pawns.find((p) => p.id === 'A0')?.pathIndex).toBe(3);
    expect(game.currentSeat).toBe('C');
  });

  it('scripted-to-result: seed 2 throws a 2 and the last pawn finishes the game', () => {
    const store = seededStore(2);
    store.setState({ game: nearlyFinished(store.getState().game!) });
    store.getState().dispatch({ type: 'Throw', seat: 'A' });
    const moves = legalMoves(store.getState().game!);
    expect(moves.map((m) => [m.pawnIds[0], m.from, m.to])).toEqual([['A3', 22, 24]]);
    store.getState().dispatch(moves[0]!.action);
    expect(store.getState().game).toMatchObject({ phase: 'finished', rankings: ['A', 'C'] });
  });
});
