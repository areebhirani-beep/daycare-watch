type KeyValue = {
  getString(key: string): string | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | boolean): void;
  remove(key: string): void;
};

/** Web: localStorage, which can be missing or throw (private mode, blocked site data), so every call is guarded. */
function local(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function session(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function store(area: () => Storage | undefined): KeyValue {
  const read = (key: string): string | undefined => {
    try {
      return area()?.getItem(key) ?? undefined;
    } catch {
      return undefined;
    }
  };
  return {
    getString: read,
    getBoolean: (key) => {
      const v = read(key);
      return v === undefined ? undefined : v === 'true';
    },
    set: (key, value) => {
      try {
        area()?.setItem(key, String(value));
      } catch {
        // Storage full or blocked: the web build only keeps conveniences here.
      }
    },
    remove: (key) => {
      try {
        area()?.removeItem(key);
      } catch {
        // see above
      }
    },
  };
}

export const storage: KeyValue = store(local);

/** This visit only (sessionStorage): what a new visit should start over, like the intro. If it fails, nothing is kept. */
export const visitStorage: KeyValue = store(session);

/** Adapter for supabase-js auth persistence. */
export const authStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

/** Adapter for the TanStack Query persister. */
export const queryStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
};
