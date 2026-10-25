import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// A phone whose GPS never answers the one-shot request (a cold GPS, a simulator).
const watchers: ((pos: { coords: { latitude: number; longitude: number } }) => void)[] = [];
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  getLastKnownPositionAsync: async () => null,
  getCurrentPositionAsync: () => new Promise(() => undefined),
  watchPositionAsync: async (_opts: unknown, cb: (typeof watchers)[number]) => {
    watchers.push(cb);
    return { remove: () => undefined };
  },
}));
jest.mock('../storage', () => {
  const m = new Map<string, string>();
  return {
    storage: {
      getString: (k: string) => m.get(k),
      set: (k: string, v: string) => void m.set(k, v),
      remove: (k: string) => void m.delete(k),
    },
  };
});
jest.mock('../runtime', () => ({ isWeb: false }));

import { findPosition, savedPosition } from '../location';

// Lets the awaited permission and last-known calls settle between timer jumps.
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('findPosition when the GPS is slow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    watchers.length = 0;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("answers 'slow' at 5 s, then gives up at 30 s instead of finding forever", async () => {
    const late = jest.fn();
    const first = findPosition(late);
    await settle();
    jest.advanceTimersByTime(5_000);
    expect(await first).toBe('slow');
    await settle();
    jest.advanceTimersByTime(25_000);
    await settle();
    expect(late).toHaveBeenCalledWith('unavailable');
  });

  it('takes the first position update when the one-shot request hangs, and saves it', async () => {
    const late = jest.fn();
    const first = findPosition(late);
    await settle();
    jest.advanceTimersByTime(5_000);
    expect(await first).toBe('slow');
    await settle();
    watchers[0]!({ coords: { latitude: 33.0198, longitude: -96.6989 } });
    await settle();
    expect(late).toHaveBeenCalledWith({ lat: 33.0198, lng: -96.6989 });
    expect(savedPosition()).toEqual({ lat: 33.0198, lng: -96.6989 });
  });
});
