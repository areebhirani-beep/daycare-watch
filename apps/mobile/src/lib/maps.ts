import { tidyCase } from './format';
import type { DaycareHeader } from './types';

const CENTER = 'Licensed Center';

/**
 * The state's one-line address, tidied for a maps search: "5853 HORIZON RD  ROCKWALL TX- 75032 7788" becomes
 * "5853 HORIZON RD, ROCKWALL, TX 75032-7788". Directions use the address, never our geocoded point.
 * Anything but a licensed center may be a private residence: whatever the record carries, it prints city and
 * 5-digit ZIP only. Called without a type (a center's own record), it prints the full line.
 */
export function addressLine(d: Pick<DaycareHeader, 'address' | 'city' | 'zip'> & { operation_type?: string | null }): string {
  if (d.operation_type !== undefined && d.operation_type !== CENTER) {
    const zip5 = (d.zip ?? '').trim().slice(0, 5);
    return [tidyCase(d.city), ['TX', zip5].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
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
  return addressLine(d);
}

/**
 * The daycare's own Google Maps listing (a search for its name and street), where parents can see the photos Google
 * shows. We link out and never copy them. Null for anything but a licensed center: no listing of a private home.
 */
export function googlePhotosUrl(d: Place & { name: string }): string | null {
  if (d.operation_type !== CENTER) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tidyCase(d.name)}, ${addressLine(d)}`)}`;
}

/** Where directions may point, or null for a home daycare: no turn-by-turn route to a private house. */
export function directionsAddress(d: Place): string | null {
  return d.operation_type === CENTER ? addressLine(d) : null;
}
