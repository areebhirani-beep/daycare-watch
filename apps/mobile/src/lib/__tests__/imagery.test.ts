import { describe, expect, it } from '@jest/globals';

import { imageryAllowed, isResidence, maxPlaceZoom } from '../imagery';

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
