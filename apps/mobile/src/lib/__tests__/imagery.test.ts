import { describe, expect, it } from '@jest/globals';

import { imageryAllowed, isResidence, maxPlaceZoom } from '../imagery';
import { addressLine, directionsAddress, googlePhotosUrl, placeAddress } from '../maps';

// The four operation types in core.daycares (Oct 24 2026): Licensed Center 9,605 · Registered Child-Care Home 1,742 ·
// Licensed Child-Care Home 1,593 · Listed Family Home 1,370.
describe('imagery rule for private residences', () => {
  it('never allows imagery for a Listed Family Home', () => {
    expect(imageryAllowed('Listed Family Home')).toBe(false);
    expect(isResidence('Listed Family Home')).toBe(true);
    expect(maxPlaceZoom('Listed Family Home')).toBeLessThanOrEqual(14);
  });

  it('treats every home type as a residence', () => {
    for (const t of ['Licensed Child-Care Home', 'Registered Child-Care Home', 'Listed Family Home']) {
      expect(imageryAllowed(t)).toBe(false);
      expect(maxPlaceZoom(t)).toBeLessThanOrEqual(14);
    }
  });

  it('allows imagery for centers only, and none for an unknown type', () => {
    expect(imageryAllowed('Licensed Center')).toBe(true);
    expect(imageryAllowed(null)).toBe(false);
    expect(imageryAllowed('Something New')).toBe(false);
  });
});

// Home fixtures keep only what the app may show: operation 175268 (Listed Family Home) and 97203 (Licensed
// Child-Care Home), street withheld, 5-digit ZIP. The center is operation 1459611 (Viva World School), as stored.
const listedHome = { address: 'withheld for privacy', city: 'GEORGETOWN', zip: '78626', operation_type: 'Listed Family Home' };
const licensedHome = { address: 'withheld for privacy', city: 'GARRISON', zip: '75946', operation_type: 'Licensed Child-Care Home' };
const center = {
  address: '5853 HORIZON RD  ROCKWALL TX- 75032 7788',
  city: 'ROCKWALL',
  zip: '75032 7788',
  operation_type: 'Licensed Center',
};

describe('addresses for private residences', () => {
  it('shows a Listed Family Home as city and ZIP, with no street and no directions', () => {
    expect(placeAddress(listedHome)).toBe('Georgetown, TX 78626');
    expect(directionsAddress(listedHome)).toBeNull();
  });

  it('does the same for every home type', () => {
    expect(placeAddress(licensedHome)).toBe('Garrison, TX 75946');
    expect(directionsAddress(licensedHome)).toBeNull();
  });

  it('never prints a street or ZIP+4 for a non-center, even when the record carries them', () => {
    // A full state address under a home type (as before migration 110000), or under an unknown type.
    for (const operation_type of ['Registered Child-Care Home', null]) {
      const shown = addressLine({ ...center, operation_type });
      expect(shown).toBe('Rockwall, TX 75032');
      expect(shown).not.toMatch(/5853|horizon|7788/i);
      expect(directionsAddress({ ...center, operation_type: operation_type as string })).toBeNull();
    }
  });

  it('keeps the full address and directions for a center', () => {
    expect(placeAddress(center)).toBe('5853 HORIZON RD, ROCKWALL, TX 75032-7788');
    expect(directionsAddress(center)).toBe('5853 HORIZON RD, ROCKWALL, TX 75032-7788');
  });
});

describe('Google Maps photos link', () => {
  it('links a center to its own listing by name and street', () => {
    const url = googlePhotosUrl({ ...center, name: 'VIVA WORLD SCHOOL' });
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    expect(decodeURIComponent(url!.split('query=')[1]!)).toBe('Viva World School, 5853 HORIZON RD, ROCKWALL, TX 75032-7788');
  });

  it('never links a home or an unknown type', () => {
    for (const d of [listedHome, licensedHome, { ...center, operation_type: null as unknown as string }]) {
      expect(googlePhotosUrl({ ...d, name: 'Any Name' })).toBeNull();
    }
  });
});
