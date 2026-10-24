import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'daycare-watch' });

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
