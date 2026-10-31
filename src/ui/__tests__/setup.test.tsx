import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { nextColor, presetSeats, setKind } from '@/ui/setup/presets';
import { SetupScreen } from '@/ui/screens/SetupScreen';
import { gameStore } from '@/ui/testing/appStoreMock';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Redirect: () => null }));
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
    gameStore.setState({ saved: null, game: null });
  });

  it('shows the playing seats with default names', async () => {
    await render(<SetupScreen />);
    expect(screen.getByDisplayValue('Player 1')).toBeTruthy();
    expect(screen.getByDisplayValue('Player 3')).toBeTruthy();
    await fireEvent.press(screen.getByText('4'));
    ['Player 1', 'Player 2', 'Player 3', 'Player 4'].forEach((n) => expect(screen.getByDisplayValue(n)).toBeTruthy());
  });

  it('disables Start until at least one seat is human', async () => {
    await render(<SetupScreen />);
    for (const b of screen.getAllByText('Bot')) await fireEvent.press(b);
    expect(screen.getByText('At least one player must be human.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it('Start creates the game and opens the game screen', async () => {
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(gameStore.getState().game?.seats.map((s) => s.kind)).toEqual(['human', 'empty', 'human', 'empty']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/game');
  });

  it('Custom rules reveal every toggle and are used for the game', async () => {
    await render(<SetupScreen />);
    await fireEvent.press(screen.getByText('Custom'));
    expect(screen.getByText('Entering pawns')).toBeTruthy();
    await fireEvent.press(screen.getByText('Keep circling the outer ring'));
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(gameStore.getState().game?.ruleConfig.noHitBehavior).toBe('circle');
  });
});
