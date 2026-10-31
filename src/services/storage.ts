// Device key-value storage: MMKV, with AsyncStorage as the fallback (R-SAVE-01).

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
    removeItem: async (key) => {
      delete data[key];
    },
  };
}

function mmkvStore(): KeyValueStore {
  // Loaded lazily: MMKV is native-only and must not load in tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native module
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  const mmkv = createMMKV({ id: 'astha-chopa' });
  return {
    getItem: async (key) => mmkv.getString(key) ?? null,
    setItem: async (key, value) => mmkv.set(key, value),
    removeItem: async (key) => {
      mmkv.remove(key);
    },
  };
}

function asyncStorageStore(): KeyValueStore {
  const AsyncStorage = (
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy fallback module
    require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')
  ).default;
  return {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  };
}

let device: KeyValueStore | null = null;

export function deviceStore(): KeyValueStore {
  if (!device) {
    try {
      device = mmkvStore();
    } catch {
      device = asyncStorageStore();
    }
  }
  return device;
}
