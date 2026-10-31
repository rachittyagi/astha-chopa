import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';
import i18next from 'i18next';

import appConfig from '../../../app.config';
import appJson from '@/config/app.json';
import { CLASSIC, type GameEvent } from '@/engine';
import { seatsOf } from '@/engine/testing/fixtures';
import en from '@/i18n/en.json';
import hi from '@/i18n/hi.json';
import { cuesFor } from '@/services/feedback';
import { memoryStore } from '@/services/storage';
import { createSettingsStore } from '@/store/settings';
import { durations, motionsFor } from '@/ui/game/motion';
import { HomeScreen } from '@/ui/screens/HomeScreen';
import { HowToPlayScreen } from '@/ui/screens/HowToPlayScreen';
import { SettingsScreen } from '@/ui/screens/SettingsScreen';
import { gameStore, settingsStore } from '@/ui/testing/appStoreMock';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Redirect: () => null }));
jest.mock('@/store/app', () => require('@/ui/testing/appStoreMock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

describe('animations from events (TASK-51, R-UI-05)', () => {
  const moved: GameEvent = { type: 'PawnMoved', pawnIds: ['A0'], from: [4, 3], squares: [[4, 4], [3, 4]] };

  it('moves square by square, then knocks a hit pawn back to its start square', () => {
    const hit: GameEvent = { type: 'PawnHit', pawnId: 'C0', by: 'A' };
    expect(motionsFor([moved, hit], 7)).toEqual([
      { id: 7, kind: 'move', pawnIds: ['A0'], from: [4, 3], path: [[4, 4], [3, 4]] },
      { id: 8, kind: 'knockback', pawnIds: ['C0'], from: [3, 4], path: [[0, 2]] },
    ]);
  });

  it('ignores events that do not move pawns', () => {
    expect(motionsFor([{ type: 'StalemateBroken' }, { type: 'TurnPassed', from: 'A', to: 'C' }], 1)).toEqual([]);
  });

  it('R-UX-04 Fast is about half of Normal, with shells rolling ~700 ms at Normal', () => {
    const normal = durations(false);
    const fast = durations(true);
    expect(normal.shellsMs).toBe(700);
    expect(fast.stepMs).toBe(normal.stepMs / 2);
    expect(fast.shellsMs).toBe(normal.shellsMs / 2);
  });
});

describe('sound and haptic cues (TASK-54, R-UX-03)', () => {
  it('throw, step, hit, home and a human win each have a cue', () => {
    const thrown = { id: 1, value: 2 as const, shells: [true, true, false, false] as const, bonus: false };
    const events: GameEvent[] = [
      { type: 'ThrowResolved', seat: 'A', throw: thrown },
      { type: 'PawnMoved', pawnIds: ['A0'], from: [4, 2], squares: [[4, 3]] },
      { type: 'PawnHit', pawnId: 'C0', by: 'A' },
      { type: 'PawnHome', pawnId: 'A1' },
      { type: 'PlayerFinished', seat: 'A', rank: 1 },
    ];
    expect(cuesFor(events, ['A'])).toEqual({ sounds: ['throw', 'step', 'hit', 'home', 'win'], haptics: ['throw', 'hit'] });
  });

  it('no win sound when a bot wins', () => {
    expect(cuesFor([{ type: 'PlayerFinished', seat: 'C', rank: 1 }], ['A']).sounds).toEqual([]);
  });
});

describe('translations (TASK-58, R-I18N-01..02)', () => {
  type Tree = { [key: string]: string | Tree };
  const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
    Object.entries(tree).reduce<Record<string, string>>(
      (acc, [k, v]) => ({ ...acc, ...(typeof v === 'string' ? { [prefix + k]: v } : flatten(v, `${prefix}${k}.`)) }),
      {},
    );
  const vars = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

  it('Hindi has every English key, with the same placeholders', () => {
    const english = flatten(en as Tree);
    const hindi = flatten(hi as Tree);
    expect(Object.keys(hindi).sort()).toEqual(Object.keys(english).sort());
    for (const key of Object.keys(english)) expect([key, vars(hindi[key]!)]).toEqual([key, vars(english[key]!)]);
  });

  it('switches language at runtime', async () => {
    await i18next.changeLanguage('hi');
    expect(i18next.t('home.play')).toBe('खेलें');
    await i18next.changeLanguage('en');
    expect(i18next.t('home.play')).toBe('Play');
  });

  it('first launch follows the device language; a saved choice wins afterwards', async () => {
    const storage = memoryStore();
    const store = createSettingsStore(storage, () => 'hi');
    await store.getState().load();
    expect(store.getState().language).toBe('hi');
    store.getState().update({ language: 'en' });
    const again = createSettingsStore(storage, () => 'hi');
    await again.getState().load();
    expect(again.getState().language).toBe('en');
  });
});

describe('app name in one place (TASK-59, R-I18N-03)', () => {
  it('app.config and the Home title read the same value', async () => {
    expect(appConfig.name).toBe(appJson.name);
    await render(<HomeScreen />);
    expect(screen.getByText(appJson.name)).toBeTruthy();
  });
});

describe('Settings screen (TASK-61, TASK-53)', () => {
  beforeEach(() => settingsStore.setState({ theme: 'chalk', sound: true, speed: 'normal', language: 'en' }));

  it('switches theme, sound and speed immediately', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText('Wooden board'));
    expect(settingsStore.getState().theme).toBe('wood');
    await fireEvent(screen.getByLabelText('Sound effects'), 'valueChange', false);
    expect(settingsStore.getState().sound).toBe(false);
    await fireEvent.press(screen.getByText('Fast'));
    expect(settingsStore.getState().speed).toBe('fast');
  });

  it('offers to reset a saved game only when one exists', async () => {
    gameStore.setState({ saved: null });
    await render(<SettingsScreen />);
    expect(screen.queryByRole('button', { name: 'Reset saved game' })).toBeNull();
  });
});

describe('How to play (TASK-60)', () => {
  it('explains the Classic rules from Home', async () => {
    gameStore.setState({ game: null });
    await render(<HowToPlayScreen />);
    expect(screen.getByText(/Use a 4 or 8 to bring one onto your start square/)).toBeTruthy();
    expect(screen.getByText(/stop at the end of the outer ring/)).toBeTruthy();
    expect(screen.getByText(/Chowka Bara, Daayam and Kanna Kauri/)).toBeTruthy();
    expect(screen.getByText(/Three 4s or 8s in a row lose the whole turn/)).toBeTruthy();
    expect(screen.getByText(/play carries on after the first winner/)).toBeTruthy();
    expect(screen.queryByText(/rules of your current game/)).toBeNull();
  });

  it('follows the current game\'s house rules', async () => {
    gameStore.getState().startGame({
      seats: seatsOf(['human', 'empty', 'human', 'empty']),
      config: { ...CLASSIC, entryRule: 'onStart', noHitBehavior: 'circle', doubles: false },
    });
    await render(<HowToPlayScreen />);
    expect(screen.getByText(/rules of your current game/)).toBeTruthy();
    expect(screen.getByText('All pawns begin on your start square.')).toBeTruthy();
    expect(screen.getByText(/keep going round the outer ring/)).toBeTruthy();
    expect(screen.getByText(/never block or move together/)).toBeTruthy();
  });
});

describe('tablet layout (TASK-55, R-LOCAL-04)', () => {
  it('puts each seat on its own side, with the throw button at the current player\'s seat', async () => {
    const rn = require('react-native');
    const dims = jest.spyOn(rn, 'useWindowDimensions').mockReturnValue({ width: 1194, height: 834, scale: 2, fontScale: 1 });
    const { GameScreen } = require('@/ui/screens/GameScreen');
    gameStore.getState().startGame({ seats: seatsOf(['human', 'human', 'human', 'human']), config: CLASSIC });
    await render(<GameScreen />);
    ['Player 1', 'Player 2', 'Player 3', 'Player 4'].forEach((name) => expect(screen.getAllByText(name).length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: 'Throw' })).toHaveLength(1);
    dims.mockRestore();
  });
});
