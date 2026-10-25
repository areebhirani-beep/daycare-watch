import { tidyCase } from './format';
import { isResidence } from './imagery';
import type { DaycareHeader } from './types';

/**
 * The state's one-line address, tidied for a maps search: "5853 HORIZON RD  ROCKWALL TX- 75032 7788" becomes
 * "5853 HORIZON RD, ROCKWALL, TX 75032-7788". Directions use the address, never our geocoded point.
 */
export function addressLine(d: Pick<DaycareHeader, 'address' | 'city' | 'zip'>): string {
  const raw = (d.address ?? '').trim();
  const city = (d.city ?? '').trim();
  const line = raw
    .replace(/\s+TX-?\s*/i, ', TX ')
    .replace(/\s{2,}/, ', ')
    .replace(/(\d{5}) (\d{4})$/, '$1-$2');
  if (city && line.toUpperCase().includes(city.toUpperCase())) return line;
  return [line, city, ['TX', d.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** Apple Maps directions to the address. */
export function appleMapsUrl(address: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
}

/** Google Maps directions to the address. A universal link: opens the Google Maps app when installed, else the web. */
export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

type Place = Pick<DaycareHeader, 'address' | 'city' | 'zip' | 'operation_type'>;

/**
 * The address a screen may show. Home daycares are private residences: city and ZIP only, never the street
 * ("Georgetown, TX 78626"). Centers get the full state address line.
 */
export function placeAddress(d: Place): string {
  if (!isResidence(d.operation_type)) return addressLine(d);
  const zip5 = (d.zip ?? '').trim().slice(0, 5);
  return [tidyCase(d.city), ['TX', zip5].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** Where directions may point, or null for a home daycare: no turn-by-turn route to a private house. */
export function directionsAddress(d: Place): string | null {
  return isResidence(d.operation_type) ? null : addressLine(d);
}
