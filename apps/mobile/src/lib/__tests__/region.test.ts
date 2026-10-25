import { describe, expect, it } from '@jest/globals';

import { regionFor, type LatLng, type Region, type Viewport } from '../region';

// iPhone 17 portrait: search pill ends at 126 pt, the half sheet starts at 315 pt.
const view: Viewport = { width: 402, height: 874, top: 126, bottom: 315 };

// Where a point lands on screen, in points from the top, for a full-screen region.
const screenY = (r: Region, p: LatLng) => view.height / 2 - ((p.latitude - r.latitude) / r.latitudeDelta) * view.height;
const screenX = (r: Region, p: LatLng) => view.width / 2 + ((p.longitude - r.longitude) / r.longitudeDelta) * view.width;

// The parent's point (simulator location in Plano) and three of its nearest daycares from daycares_near, Oct 25 2026.
const plano: LatLng[] = [
  { latitude: 33.0198, longitude: -96.6989 },
  { latitude: 33.023828260385, longitude: -96.695302274792 },
  { latitude: 33.013732845401, longitude: -96.703700419445 },
  { latitude: 33.031516077984, longitude: -96.69715248307 },
];

describe('regionFor', () => {
  it('returns null with nothing to show', () => {
    expect(regionFor([], view)).toBeNull();
  });

  it('puts every pin inside the strip above the sheet', () => {
    const r = regionFor(plano, view)!;
    for (const p of plano) {
      expect(screenY(r, p)).toBeGreaterThan(view.top);
      expect(screenY(r, p)).toBeLessThan(view.bottom);
      expect(screenX(r, p)).toBeGreaterThan(0);
      expect(screenX(r, p)).toBeLessThan(view.width);
    }
  });

  it('stays at neighborhood zoom, not county zoom', () => {
    const r = regionFor(plano, view)!;
    expect(r.latitudeDelta).toBeLessThan(0.2);
    expect(r.longitudeDelta).toBeLessThan(0.15);
  });

  it('gives a single point a street-level span', () => {
    const r = regionFor([plano[0]!], view)!;
    expect(r.latitudeDelta).toBeGreaterThan(0);
    expect(screenY(r, plano[0]!)).toBeCloseTo((view.top + view.bottom) / 2, 5);
  });
});
