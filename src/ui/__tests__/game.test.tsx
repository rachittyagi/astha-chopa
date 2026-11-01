import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import i18next from 'i18next';

import { CLASSIC } from '@/engine';
import { game, place, rigged, seatsOf, withHit, withPool } from '@/engine/testing/fixtures';
import { Board } from '@/ui/game/Board';
import { messageFor, throwPhrase } from '@/ui/game/messages';
import { durations } from '@/ui/game/motion';
import { selectionView } from '@/ui/game/selection';
import { GameScreen } from '@/ui/screens/GameScreen';
import { gameStore } from '@/ui/testing/appStoreMock';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Redirect: () => null }));
jest.mock('@/store/app', () => require('@/ui/testing/appStoreMock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

describe('Board (TASK-45)', () => {
  it('labels pawns and lets only movable ones be pressed', async () => {
    const state = withPool(place(game(), { A0: 1, C0: 3 }), [2]);
    const onPawnPress = jest.fn();
    await render(<Board state={state} size={300} view={selectionView(state, null, null)} onPawnPress={onPawnPress} />);
    await fireEvent.press(screen.getByLabelText('Red pawn 1, square 2, outer ring'));
    expect(onPawnPress).toHaveBeenCalledWith('A0');
    expect(screen.getByLabelText('Yellow pawn 1, square 4, outer ring')).toBeDisabled();
  });

  it('draws every pawn separately, even when several share a square (R-UI-07)', async () => {
    const state = place(game(), { A0: 3, A1: 3, A2: 3 });
    await render(<Board state={state} size={300} view={selectionView(state, null, null)} onPawnPress={jest.fn()} />);
    for (const n of [1, 2, 3]) expect(screen.getByLabelText(`Red pawn ${n}, square 4, outer ring`)).toBeTruthy();
    expect(screen.getAllByLabelText(/Yellow pawn \d, waiting on the start square/)).toHaveLength(4);
  });

  it('draws waiting pawns on their start square; a 4 or 8 makes them tappable', async () => {
    const onWaitingPress = jest.fn();
    const quiet = place(game(), { A0: 3 });
    await render(
      <Board state={quiet} size={300} view={selectionView(quiet, null, null)} onPawnPress={jest.fn()} onWaitingPress={onWaitingPress} />,
    );
    expect(screen.getByLabelText('Red pawn 2, waiting on the start square')).toBeDisabled();
    expect(screen.getByLabelText('Yellow pawn 1, waiting on the start square')).toBeDisabled();

    const ready = withPool(place(game(), { A0: 3 }), [4]);
    await render(
      <Board state={ready} size={300} view={selectionView(ready, null, null)} onPawnPress={jest.fn()} onWaitingPress={onWaitingPress} />,
    );
    await fireEvent.press(screen.getByLabelText('Red pawn 4, waiting on the start square'));
    expect(onWaitingPress).toHaveBeenCalled();
    expect(screen.getByLabelText('Yellow pawn 1, waiting on the start square')).toBeDisabled();
  });
});

describe('event messages (R-UI-06, R-A11Y-02)', () => {
  const t = i18next.t.bind(i18next);
  const state = game();

  it('speaks the throw clearly: just "3", or "Chamma!" / "Ashta!", and in Hindi', async () => {
    expect([throwPhrase(3, t), throwPhrase(4, t), throwPhrase(8, t)]).toEqual(['3', 'Chamma!', 'Ashta!']);
    await i18next.changeLanguage('hi');
    expect([throwPhrase(2, t), throwPhrase(4, t), throwPhrase(8, t)]).toEqual(['2', 'चम्मा!', 'अष्टा!']);
    await i18next.changeLanguage('en');
  });
  it('calls out Chamma and Ashta, and announces every throw', () => {
    const thrown = (value: 4 | 8 | 2) => ({ id: 1, value, shells: [true, true, true, true] as const, bonus: false });
    expect(messageFor({ type: 'ThrowResolved', seat: 'A', throw: thrown(4) }, state, t)).toEqual({
      callout: 'Chamma! Throw again',
      announce: 'Player 1 threw 4',
    });
    expect(messageFor({ type: 'ThrowResolved', seat: 'A', throw: thrown(8) }, state, t).callout).toBe('Ashta! Throw again');
    expect(messageFor({ type: 'ThrowResolved', seat: 'A', throw: thrown(2) }, state, t).callout).toBeUndefined();
  });

  it('covers hits, no legal move, forfeits, finishing and turn changes', () => {
    expect(messageFor({ type: 'PawnHit', pawnId: 'C0', by: 'A' }, state, t).callout).toBe('Hit! Bonus throw');
    expect(messageFor({ type: 'PoolDiscarded', seat: 'A', throws: [] }, state, t).callout).toBe('No legal move');
    expect(messageFor({ type: 'TurnForfeited', seat: 'A', throws: [] }, state, t).callout).toMatch(/forfeited/);
    expect(messageFor({ type: 'InnerRingUnlocked', seat: 'A' }, state, t).callout).toBe('Inner ring unlocked');
    expect(messageFor({ type: 'PlayerFinished', seat: 'C', rank: 2 }, state, t).callout).toBe('Player 3 finished in place 2');
    expect(messageFor({ type: 'PlayerFinished', seat: 'C', rank: 1 }, state, t)).toEqual({});
    expect(messageFor({ type: 'TurnPassed', from: 'A', to: 'C' }, state, t)).toEqual({ announce: "Player 3's turn" });
    expect(messageFor({ type: 'StalemateBroken' }, state, t).callout).toMatch(/circle/);
    expect(messageFor({ type: 'PawnHome', pawnId: 'A0' }, state, t).callout).toBe('A pawn reached home');
    expect(messageFor({ type: 'GameOver', rankings: [] }, state, t)).toEqual({});
  });
});

describe('Game screen (TASK-46, TASK-48)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gameStore.getState().startGame({ seats: seatsOf(['human', 'empty', 'human', 'empty']), config: CLASSIC });
  });

  it('shows whose turn it is and throws on tap, revealing each throw once the shells settle (R-LOCAL-03, R-UI-01)', async () => {
    jest.useFakeTimers();
    gameStore.setState({ game: rigged(gameStore.getState().game!, [4, 2]) });
    await render(<GameScreen />);
    expect(screen.getByText('Your turn')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Throw' }));
    // While the shells tumble, neither the chip nor "Throw again" gives the 4 away.
    expect(screen.queryByLabelText('Throw of 4')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Throw again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Throw' })).toBeDisabled();
    await act(() => {
      jest.advanceTimersByTime(durations(false).shellsMs);
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Throw again' }));
    await act(() => {
      jest.advanceTimersByTime(durations(false).shellsMs);
    });
    expect(screen.getByLabelText('Throw of 4')).toBeTruthy();
    expect(screen.getByLabelText('Throw of 2')).toBeDisabled();
    jest.useRealTimers();
  });

  it('enters a pawn from the waiting area with a 4', async () => {
    gameStore.setState({ game: withPool(gameStore.getState().game!, [4, 2]) });
    await render(<GameScreen />);
    await fireEvent.press(screen.getByLabelText('Red pawn 1, waiting on the start square'));
    expect(gameStore.getState().game?.pawns.find((p) => p.id === 'A0')?.pathIndex).toBe(0);
  });

  it('pause menu quits to Home and keeps the game saved', async () => {
    await render(<GameScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rules summary' }));
    expect(screen.getByText('Entering pawns: Need a 4 or 8 to enter a pawn')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Quit to Home' }));
    expect(gameStore.getState().game).toBeNull();
    expect(gameStore.getState().saved).not.toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('celebrates the winner once the winning move has played, then goes to the results on Continue', async () => {
    jest.useFakeTimers();
    const base = withHit(place(gameStore.getState().game!, { A0: 24, A1: 24, A2: 24, A3: 22 }), 'A');
    gameStore.setState({ game: withPool(base, [2]) });
    await render(<GameScreen />);
    await fireEvent.press(screen.getByLabelText('Red pawn 4, square 23, inner ring'));
    // The pawn is still walking home: no overlay over the board yet, and no jump to the results.
    expect(screen.queryByText('Player 1 wins!')).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/result');
    await act(() => {
      jest.advanceTimersByTime(2 * durations(false).stepMs + 50);
    });
    jest.useRealTimers();
    expect(screen.getByText('Player 1 wins!')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/result');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/result');
  });

  it('a Chamma\'s reveal still happens when the next action lands while the shells roll', async () => {
    jest.useFakeTimers();
    gameStore.setState({ game: rigged(gameStore.getState().game!, [4, 2]) });
    await render(<GameScreen />);
    await act(() => {
      gameStore.getState().dispatch({ type: 'Throw', seat: 'A' });
    });
    expect(screen.queryByText('Chamma! Throw again', { includeHiddenElements: true })).toBeNull();
    // The 2 arrives before the 4's shells settle: the 4 is still called out, not lost.
    // (The callout is hidden from screen readers, which get their own announcement.)
    await act(() => {
      gameStore.getState().dispatch({ type: 'Throw', seat: 'A' });
    });
    expect(screen.getByText('Chamma! Throw again', { includeHiddenElements: true })).toBeTruthy();
    jest.useRealTimers();
  });

  it('Restart from the pause menu drops the previous game\'s throw', async () => {
    jest.useFakeTimers();
    // A 2 with every pawn still waiting: nothing to move, so the shells stay on show.
    gameStore.setState({ game: rigged(gameStore.getState().game!, [2]) });
    await render(<GameScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Throw' }));
    await act(() => {
      jest.advanceTimersByTime(durations(false).shellsMs);
    });
    expect(screen.getByLabelText(/^2: /)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Restart with same setup' }));
    expect(screen.queryByLabelText(/^2: /)).toBeNull();
    jest.useRealTimers();
  });

  it('plays bot turns on its own after a short pause (R-BOT-02)', async () => {
    jest.useFakeTimers();
    gameStore.getState().startGame({ seats: seatsOf(['human', 'empty', 'bot', 'empty']), config: CLASSIC });
    // A pawn already out and a rigged 2, so the bot's throw is followed by a move.
    const out = rigged(place(gameStore.getState().game!, { C0: 3 }), [2]);
    gameStore.setState({ game: { ...out, currentSeat: 'C' } });
    await render(<GameScreen />);
    const before = gameStore.getState().game;
    await act(() => {
      jest.advanceTimersByTime(1000);
    });
    const thrown = gameStore.getState().game;
    expect(thrown).not.toBe(before);
    expect(thrown?.phase).toBe('moving');
    // The shells roll, then the throw stays readable before the bot moves a pawn.
    await act(() => {
      jest.advanceTimersByTime(durations(false).shellsMs + 1000);
    });
    expect(gameStore.getState().game).toBe(thrown);
    await act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(gameStore.getState().game).not.toBe(thrown);
    jest.useRealTimers();
  });
});
