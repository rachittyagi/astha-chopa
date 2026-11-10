import { memoryStore } from '@/services/storage';
import { createSettingsStore, DEFAULT_SETTINGS, SETTINGS_KEY } from '@/store/settings';

describe('settings store (R-SAVE-03)', () => {
  it('starts from the defaults: festival theme, sound and haptics on, normal speed, English', async () => {
    const store = createSettingsStore(memoryStore());
    await store.getState().load();
    expect(store.getState()).toMatchObject({ ...DEFAULT_SETTINGS, loaded: true });
  });

  it('persists updates under its own key and restores them', async () => {
    const storage = memoryStore();
    const store = createSettingsStore(storage);
    await store.getState().load();
    store.getState().update({ theme: 'wood', sound: false });
    expect(JSON.parse(storage.data[SETTINGS_KEY]!)).toMatchObject({ theme: 'wood', sound: false });

    const again = createSettingsStore(storage);
    await again.getState().load();
    expect(again.getState()).toMatchObject({ theme: 'wood', sound: false, haptics: true });
  });

  it('a change made before the saved settings finish loading is kept', async () => {
    const storage = memoryStore({ [SETTINGS_KEY]: JSON.stringify({ theme: 'wood', speed: 'fast' }) });
    const store = createSettingsStore(storage);
    const loading = store.getState().load();
    store.getState().update({ theme: 'chalk' });
    await loading;
    expect(store.getState()).toMatchObject({ theme: 'chalk', speed: 'fast', loaded: true });
    // The early change does not overwrite the other stored settings with defaults.
    expect(JSON.parse(storage.data[SETTINGS_KEY]!)).toMatchObject({ theme: 'chalk', speed: 'fast' });
  });

  it('a later load uses the stored values again', async () => {
    const storage = memoryStore();
    const store = createSettingsStore(storage);
    const loading = store.getState().load();
    store.getState().update({ theme: 'chalk' });
    await loading;
    storage.data[SETTINGS_KEY] = JSON.stringify({ theme: 'wood' });
    await store.getState().load();
    expect(store.getState().theme).toBe('wood');
  });

  it('ignores unknown or corrupt values', async () => {
    const storage = memoryStore({ [SETTINGS_KEY]: JSON.stringify({ theme: 'neon', speed: 'fast' }) });
    const store = createSettingsStore(storage);
    await store.getState().load();
    expect(store.getState()).toMatchObject({ theme: DEFAULT_SETTINGS.theme, speed: 'fast' });

    const broken = createSettingsStore(memoryStore({ [SETTINGS_KEY]: '{' }));
    await broken.getState().load();
    expect(broken.getState().theme).toBe(DEFAULT_SETTINGS.theme);
  });
});
