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

/**
 * The building on the first screen: Castle Montessori of Frisco, a licensed center inside TX-04. A clean, recognisable
 * school building with no open findings on its record, so the splash never puts a business with open problems up front.
 * Shown by city and type only, like the example above.
 */
export const WELCOME_OPERATION_ID = 1447992;


/** Where the "near you" cards start before the parent shares a location: Frisco, inside TX-04. */
export const ONBOARDING_AREA = { lat: 33.1507, lng: -96.8236, label: 'Near Frisco' } as const;

/** The pipeline's push copy, word for word (services/pipeline/src/pipeline/notify.py NEW_FINDINGS). */
export function pushBody(n: number, visitDate: string): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(visitDate);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const when = d ? `${months[Number(d[2]) - 1]} ${Number(d[3])}, ${d[1]}` : visitDate;
  return `The state posted ${n} new ${n === 1 ? 'finding' : 'findings'} from a visit on ${when}. Tap to read what inspectors wrote.`;
}
