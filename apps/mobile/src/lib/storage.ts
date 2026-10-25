import { isExpoGo } from './runtime';

type KeyValue = {
  getString(key: string): string | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | boolean): void;
  remove(key: string): void;
};

/** Expo Go has no MMKV: use the SQLite key-value store it does ship, through its synchronous API. */
function sqliteStore(): KeyValue {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const kv = (require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store')).default;
  return {
    getString: (key) => kv.getItemSync(key) ?? undefined,
    getBoolean: (key) => {
      const v = kv.getItemSync(key);
      return v === null ? undefined : v === 'true';
    },
    set: (key, value) => kv.setItemSync(key, String(value)),
    remove: (key) => {
      kv.removeItemSync(key);
    },
  };
}

function mmkvStore(): KeyValue {
  // Required lazily so Expo Go never loads the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  return createMMKV({ id: 'daycare-watch' });
}

export const storage: KeyValue = isExpoGo ? sqliteStore() : mmkvStore();

/** Kept for good on a phone. (On the web it lasts one visit: storage.web.ts.) */
export const visitStorage: KeyValue = storage;

/** Adapter for supabase-js auth persistence. */
export const authStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

/** Adapter for the TanStack Query persister (offline cache of watched daycares). */
export const queryStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
};
