import type { DaycareHeader } from './types';

/** "123 Main St, Rockwall, TX 75087" from the state record. Directions use the address, never our geocoded point. */
export function addressLine(d: Pick<DaycareHeader, 'address' | 'city' | 'zip'>): string {
  return [d.address, d.city, ['TX', d.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** Apple Maps directions to the address. */
export function appleMapsUrl(address: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
}

/** Google Maps directions to the address. A universal link: opens the Google Maps app when installed, else the web. */
export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
