import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { CLASSIC } from '@/engine';
import { nextColor, presetSeats, setKind } from '@/ui/setup/presets';
import { SetupScreen } from '@/ui/screens/SetupScreen';
import { gameStore, settingsStore } from '@/ui/testing/appStoreMock';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: { then?: string } = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, Redirect: () => null }));
jest.mock('@/store/app', () => require('@/ui/testing/appStoreMock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

describe('setup presets (R-MODE-01..04)', () => {
  it('1 player = a human on A and a Medium bot opposite', () => {
    expect(presetSeats(1).map((s) => [s.kind, s.botLevel])).toEqual([
      ['human', undefined],
      ['empty', undefined],
      ['bot', 'medium'],
      ['empty', undefined],
    ]);
  });

  it('2 players sit opposite; 3 leave D empty; names default to Player 1–4', () => {
    expect(presetSeats(2).map((s) => s.kind)).toEqual(['human', 'empty', 'human', 'empty']);
    expect(presetSeats(3).map((s) => s.kind)).toEqual(['human', 'human', 'human', 'empty']);
    expect(presetSeats(4).map((s) => s.name)).toEqual(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  });

  it('switching preset keeps names the user typed', () => {
    const renamed = presetSeats(2).map((s, i) => (i === 0 ? { ...s, name: 'Asha' } : s));
    expect(presetSeats(4, renamed)[0]?.name).toBe('Asha');
  });

  it('a colour change skips colours other seats use', () => {
    const seats = presetSeats(4);
    expect(nextColor(seats, 0)).toBe('purple');
  });

  it('switching a bot to human drops its level', () => {
    expect(setKind(presetSeats(1), 2, 'human')[2]).toEqual({ kind: 'human', name: 'Player 3', color: 'yellow' });
    expect(setKind(presetSeats(2), 1, 'bot')[1]).toMatchObject({ kind: 'bot', botLevel: 'medium' });
  });
});

describe('Game setup screen (TASK-44)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gameStore.setState({ saved: null, game: null, lastSetup: null });
  });

  it('shows the playing seats with default names', async () => {
    await render(<SetupScreen />);
    expect(screen.getByDisplayValue('Player 1')).toBeTruthy();
    expect(screen.getByDisplayValue('Player 3')).toBeTruthy();
    await fireEvent.press(screen.getByText('4'));
    ['Player 1', 'Player 2', 'Player 3', 'Player 4'].forEach((n) => expect(screen.getByDisplayValue(n)).toBeTruthy());
  });

  it('disables Save until at least one seat is human', async () => {
    await render(<SetupScreen />);
    for (const b of screen.getAllByText('Computer')) await fireEvent.press(b);
    expect(screen.getByText('At least one player must be human.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('first time: you against one computer player; Save remembers it and goes back without starting', async () => {
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(gameStore.getState().game).toBeNull();
    expect(gameStore.getState().lastSetup?.seats.map((s) => s.kind)).toEqual(['human', 'empty', 'bot', 'empty']);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('Cancel leaves the remembered setup alone', async () => {
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByText('4'));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(gameStore.getState().lastSetup).toBeNull();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('with nothing to go back to, Save goes Home', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('from Results, Save and play starts the next game with the new players', async () => {
    mockParams = { then: 'play' };
    try {
      await render(<SetupScreen />);
      await fireEvent.press(screen.getByText('4'));
      await fireEvent.press(screen.getByRole('button', { name: 'Save and play' }));
      expect(gameStore.getState().game?.seats.filter((s) => s.kind !== 'empty')).toHaveLength(4);
      expect(mockRouter.replace).toHaveBeenCalledWith('/game');
    } finally {
      mockParams = {};
    }
  });

  it('opens with the players and rules used last time', async () => {
    const seats = presetSeats(3).map((s, i) => (i === 1 ? { ...s, name: 'Dadi' } : s));
    gameStore.setState({ lastSetup: { seats, config: { ...CLASSIC, noHitBehavior: 'circle' } } });
    await render(<SetupScreen />);
    expect(screen.getByDisplayValue('Dadi')).toBeTruthy();
    expect(screen.getByText('Keep circling the outer ring')).toBeTruthy();
  });

  it('Custom rules reveal every toggle and are saved', async () => {
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByText('Custom'));
    expect(screen.getByText('Entering pawns')).toBeTruthy();
    // Each rule is one row showing its value; tapping it opens the choices.
    await fireEvent.press(screen.getByRole('button', { name: 'Before your first hit: Enter the inner ring any time' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Keep circling the outer ring' }));
    expect(screen.getByRole('button', { name: 'Before your first hit: Keep circling the outer ring' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(gameStore.getState().lastSetup?.config.noHitBehavior).toBe('circle');
  });

  it('Save and play from Home starts a game with the chosen players', async () => {
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByText('4'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save and play' }));
    expect(gameStore.getState().game?.seats.filter((s) => s.kind === 'human')).toHaveLength(4);
    expect(mockRouter.replace).toHaveBeenCalledWith('/game');
  });

  it('Save and play asks before replacing an unfinished game', async () => {
    gameStore.getState().startGame({ seats: presetSeats(2), config: CLASSIC });
    const unfinished = gameStore.getState().game;
    gameStore.setState({ game: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save and play' }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2]!;
    await act(() => buttons.find((b) => b.text === 'Replace')!.onPress!());
    expect(gameStore.getState().game?.id).not.toBe(unfinished?.id);
    expect(mockRouter.replace).toHaveBeenCalledWith('/game');
    alert.mockRestore();
  });

  it('Classic rules offer the inner-ring choice, which also becomes the default', async () => {
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Inner ring: Open from the start' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Needs a hit first' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(gameStore.getState().lastSetup?.config.noHitBehavior).toBe('block');
    expect(settingsStore.getState().innerRing).toBe('hit');
    settingsStore.setState({ innerRing: 'open' });
  });

  it('labels each seat\'s name, colour and computer level', async () => {
    await render(<SetupScreen />);
    expect(screen.getByRole('button', { name: 'Colour: Red' })).toBeTruthy();
    expect(screen.getAllByText('Name').length).toBeGreaterThan(0);
    expect(screen.getByText('Computer level')).toBeTruthy();
    expect(screen.getByText('1 vs computer')).toBeTruthy();
  });
});
