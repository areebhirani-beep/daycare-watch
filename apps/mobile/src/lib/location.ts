import * as Location from 'expo-location';

import { isWeb } from './runtime';
import { storage } from './storage';

export type Point = { lat: number; lng: number };

/** What the parent's location lookup came to. `slow` keeps listening and reports the fix through `onLate`. */
export type Position = Point | 'denied' | 'slow';

const LAST_POSITION = 'last-position';
const TIMEOUT_MS = 5_000;

/** Where the parent was last time, kept on this phone only, so lists can load before location answers. */
export function savedPosition(): Point | null {
  try {
    const raw = storage.getString(LAST_POSITION);
    return raw ? (JSON.parse(raw) as Point) : null;
  } catch {
    return null;
  }
}

export function savePosition(p: Point): void {
  storage.set(LAST_POSITION, JSON.stringify(p));
}

export function forgetPosition(): void {
  storage.remove(LAST_POSITION);
}

/**
 * Asks once, then answers within 5 s: a point, 'denied', or 'slow'. When slow, the lookup keeps going and a late
 * fix arrives through `onLate`, so a cold GPS doesn't read as "location off". Every fix is saved for next launch.
 * The web link never asks: a browser location prompt is the wrong first screen for a judge.
 */
export async function findPosition(onLate?: (p: Point) => void): Promise<Position> {
  if (isWeb) return 'denied';
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const last = await Location.getLastKnownPositionAsync();
    if (last) return keep({ lat: last.coords.latitude, lng: last.coords.longitude });
    const fix = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((pos) =>
      keep({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    );
    const timer = new Promise<'slow'>((resolve) => setTimeout(() => resolve('slow'), TIMEOUT_MS));
    const first = await Promise.race([fix, timer]);
    if (first === 'slow') void fix.then((p) => onLate?.(p)).catch(() => undefined);
    return first;
  } catch {
    return 'denied';
  }
}

function keep(p: Point): Point {
  savePosition(p);
  return p;
}
