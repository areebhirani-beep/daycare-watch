import { storage } from '@/lib/storage';

const KEY = 'onboarded.v1';

/** True once the parent has finished or skipped onboarding on this device. */
export function hasOnboarded(): boolean {
  return storage.getBoolean(KEY) === true;
}

export function markOnboarded(): void {
  storage.set(KEY, true);
}

/**
 * The daycare the first screen draws: Viva World School, a licensed center in Rockwall inside TX-04.
 * Picked because its real 24-month record shows every kind of mark the strip uses. It is shown by
 * city and type only, never by name, so the app does not single out one business.
 */
export const EXAMPLE_OPERATION_ID = 1459611;
