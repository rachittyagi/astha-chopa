import { CLASSIC } from '@/engine';
import { game, seatsOf } from '@/engine/testing/fixtures';
import { parseSavedGame, parseSetup } from '@/services/persistence';
import { memoryStore } from '@/services/storage';
import { createGameStore } from '@/store/game';
import { createSettingsStore, defaultRules, houseRules, SETTINGS_KEY } from '@/store/settings';

describe('house rules from Settings', () => {
  it('apply to every new game, whatever the setup chose', () => {
    const settings = createSettingsStore(memoryStore());
    settings.getState().update({ rethrowOnOne: true, hitNeedsEntry: true, bonusOnHome: true });
    let seed = 1;
    const store = createGameStore({
      storage: memoryStore(),
      now: () => 1,
      newSeed: () => seed++,
      houseRules: () => houseRules(settings.getState()),
    });
    store.getState().startGame({ seats: seatsOf(['human', 'empty', 'bot', 'empty']), config: CLASSIC });
    expect(store.getState().game!.ruleConfig).toMatchObject({ rethrowOnOne: true, hitNeedsEntry: true, bonusOnHome: true });
    // Restart and Play again reuse the setup, which now carries them too.
    expect(store.getState().setup!.config).toMatchObject({ rethrowOnOne: true, hitNeedsEntry: true, bonusOnHome: true });
  });

  it('are off by default and remembered between launches', async () => {
    const storage = memoryStore();
    const first = createSettingsStore(storage);
    await first.getState().load();
    expect(defaultRules(first.getState())).toEqual({ ...CLASSIC });
    first.getState().update({ rethrowOnOne: true, bonusOnHome: true });
    expect(JSON.parse((await storage.getItem(SETTINGS_KEY))!)).toMatchObject({ rethrowOnOne: true, hitNeedsEntry: false });
    const again = createSettingsStore(storage);
    await again.getState().load();
    expect(again.getState()).toMatchObject({ rethrowOnOne: true, hitNeedsEntry: false, bonusOnHome: true });
  });

  it('saves and setups from before these rules still load, with them off', () => {
    const { rethrowOnOne: _a, hitNeedsEntry: _b, ...oldRules } = CLASSIC;
    const old = { ...game(), ruleConfig: oldRules };
    const loaded = parseSavedGame(JSON.stringify(old));
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.state.ruleConfig).toEqual(CLASSIC);
    const setup = parseSetup(JSON.stringify({ seats: seatsOf(['human', 'empty', 'bot', 'empty']), config: oldRules }));
    expect(setup?.config).toEqual(CLASSIC);
  });
});
