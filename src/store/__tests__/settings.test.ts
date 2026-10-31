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
    createSettingsStore(storage).getState().update({ theme: 'wood', sound: false });
    expect(JSON.parse(storage.data[SETTINGS_KEY]!)).toMatchObject({ theme: 'wood', sound: false });

    const again = createSettingsStore(storage);
    await again.getState().load();
    expect(again.getState()).toMatchObject({ theme: 'wood', sound: false, haptics: true });
  });

  it('ignores unknown or corrupt values', async () => {
    const storage = memoryStore({ [SETTINGS_KEY]: JSON.stringify({ theme: 'neon', speed: 'fast' }) });
    const store = createSettingsStore(storage);
    await store.getState().load();
    expect(store.getState()).toMatchObject({ theme: 'festive', speed: 'fast' });

    const broken = createSettingsStore(memoryStore({ [SETTINGS_KEY]: '{' }));
    await broken.getState().load();
    expect(broken.getState().theme).toBe('festive');
  });
});
