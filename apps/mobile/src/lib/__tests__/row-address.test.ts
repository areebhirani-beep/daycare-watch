import { describe, expect, it, jest } from '@jest/globals';

import { rowFallback, rowMeta } from '@/components/ui/HomeMap';

import { placeAddress } from '../maps';
import type { DaycareRow } from '../types';

// The row helpers are pure; the sheet, map and animation modules only matter on a device.
jest.mock('@gorhom/bottom-sheet', () => ({}));
jest.mock('react-native-maps', () => ({}));
jest.mock('react-native-reanimated', () => ({}));

// daycare_search('78626') row for operation 175268, a Listed Family Home, as returned Oct 24 2026.
const row = {
  operation_id: 175268,
  name: 'Felicia Reynolds',
  operation_type: 'Listed Family Home',
  address: 'withheld for privacy  GEORGETOWN TX- 78626 ####',
  city: 'GEORGETOWN',
  zip: '78626 ####',
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
    expect(text).not.toMatch(/2309|caprock/i);
  });
});
