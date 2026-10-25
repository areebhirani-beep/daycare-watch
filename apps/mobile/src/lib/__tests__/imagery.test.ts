import { describe, expect, it } from '@jest/globals';

import { imageryAllowed, isResidence, maxPlaceZoom } from '../imagery';
import { directionsAddress, placeAddress } from '../maps';

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

// Address fields of real records in core.daycares: operation 175268 (Listed Family Home) and 97203
// (Licensed Child-Care Home).
const listedHome = {
  address: 'withheld for privacy  GEORGETOWN TX- 78626 ####',
  city: 'GEORGETOWN',
  zip: '78626 ####',
  operation_type: 'Listed Family Home',
};
const licensedHome = {
  address: 'withheld for privacy  GARRISON TX- 75946 ####',
  city: 'GARRISON',
  zip: '75946 ####',
  operation_type: 'Licensed Child-Care Home',
};

describe('addresses for private residences', () => {
  it('shows a Listed Family Home as city and ZIP, with no street and no directions', () => {
    const shown = placeAddress(listedHome);
    expect(shown).toBe('Georgetown, TX 78626');
    expect(shown).not.toMatch(/2309|caprock/i);
    expect(directionsAddress(listedHome)).toBeNull();
  });

  it('does the same for every home type', () => {
    expect(placeAddress(licensedHome)).toBe('Garrison, TX 75946');
    expect(placeAddress(licensedHome)).not.toMatch(/3885|fitze/i);
    expect(directionsAddress(licensedHome)).toBeNull();
  });

  it('keeps the full address and directions for a center', () => {
    const center = { ...licensedHome, operation_type: 'Licensed Center' };
    expect(placeAddress(center)).toBe('withheld for privacy, GARRISON, TX 75946 ####');
    expect(directionsAddress(center)).toBe('withheld for privacy, GARRISON, TX 75946 ####');
  });
});
