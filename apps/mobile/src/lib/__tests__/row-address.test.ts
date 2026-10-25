import { describe, expect, it, jest } from '@jest/globals';

import { rowFallback, rowMeta } from '@/components/ui/HomeMap';

import { placeAddress } from '../maps';
import type { DaycareRow } from '../types';

// The row helpers are pure; the sheet, map and animation modules only matter on a device.
jest.mock('@gorhom/bottom-sheet', () => ({}));
jest.mock('react-native-maps', () => ({}));
// Theme modules build easings at import time, so every reanimated export is a callable no-op here.
jest.mock('react-native-reanimated', () => {
  const stub: object = new Proxy(() => stub, { get: (_target, key) => (key === '__esModule' ? true : stub) });
  return stub;
});

// daycare_search('78626') row for operation 175268, a Listed Family Home (Oct 24 2026): street withheld, ZIP5,
// point rounded to 2 decimals, as repo fixtures carry homes.
const row = {
  operation_id: 175268,
  name: 'withheld for privacy',
  operation_type: 'Listed Family Home',
  address: 'withheld for privacy',
  city: 'GEORGETOWN',
  zip: '78626',
  county: 'WILLIAMSON',
  lat: 30.63,
  lng: -97.65,
  distance_km: null,
  capacity: 3,
  last_inspection_date: null,
  findings_24mo: 0,
  in_district: false,
  district_basis: 'point',
  visits_24mo: [],
  geocode_source: 'census',
  geocode_quality: 'exact',
} as unknown as DaycareRow;

describe('a list row for a home daycare', () => {
  it('renders no street address anywhere in the row text', () => {
    const text = [rowMeta(row, '2026-10-24'), rowFallback(row), placeAddress(row)].join(' | ');
    expect(text).toBe('Listed home · Georgetown | No state visits posted in 2 years | Georgetown, TX 78626');
    expect(text).not.toMatch(/withheld/i);
  });
});
