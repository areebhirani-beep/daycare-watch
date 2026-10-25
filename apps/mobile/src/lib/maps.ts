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
