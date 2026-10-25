import * as Location from 'expo-location';

import { isWeb } from './runtime';
import { storage } from './storage';

export type Point = { lat: number; lng: number };

/**
 * What the parent's location lookup came to. `slow` keeps listening and reports the fix through `onLate`;
 * `unavailable` is what a slow lookup turns into when nothing arrives at all.
 */
export type Position = Point | 'denied' | 'slow' | 'unavailable';

const LAST_POSITION = 'last-position';
const TIMEOUT_MS = 5_000;
const GIVE_UP_MS = 30_000;

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
 * fix (or 'unavailable' after 30 s) arrives through `onLate`, so a cold GPS doesn't read as "location off" and
 * never reads "finding" forever. Every fix is saved for next launch.
 * The web link never asks: a browser location prompt is the wrong first screen for a judge.
 */
export async function findPosition(onLate?: (p: Position) => void): Promise<Position> {
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
    if (first === 'slow') void lateFix(fix).then((p) => onLate?.(p));
    return first;
  } catch {
    return 'denied';
  }
}

/**
 * After the 5 s answer: whichever comes first of the one-shot fix, the first position update, or giving up at 30 s.
 * The one-shot request can hang (a cold GPS, a simulator), and an update arrives as soon as the phone moves.
 */
async function lateFix(fix: Promise<Point>): Promise<Position> {
  let sub: Location.LocationSubscription | null = null;
  const update = new Promise<Point>((resolve) => {
    void Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced }, (pos) =>
      resolve(keep({ lat: pos.coords.latitude, lng: pos.coords.longitude })),
    )
      .then((s) => {
        sub = s;
      })
      .catch(() => undefined);
  });
  const giveUp = new Promise<'unavailable'>((resolve) => setTimeout(() => resolve('unavailable'), GIVE_UP_MS - TIMEOUT_MS));
  const result = await Promise.race([fix.catch(() => 'unavailable' as const), update, giveUp]);
  (sub as Location.LocationSubscription | null)?.remove();
  return result;
}

function keep(p: Point): Point {
  savePosition(p);
  return p;
}
