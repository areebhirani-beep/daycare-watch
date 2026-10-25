import { describe, expect, it, jest } from '@jest/globals';

import { formatLocalDay, tidyCase } from '../format';

describe('formatLocalDay', () => {
  it('uses the local calendar day, not the UTC date in the string', () => {
    const t = new Date(2026, 9, 24, 22, 59); // Oct 24, 10:59 pm local
    expect(formatLocalDay(t.toISOString())).toBe('Oct 24, 2026');
  });

  it('returns empty for missing or bad input', () => {
    expect(formatLocalDay(null)).toBe('');
    expect(formatLocalDay('not a date')).toBe('');
  });
});

describe('map links', () => {
  it('route to the state record address, encoded', () => {
    const { addressLine, appleMapsUrl, googleMapsUrl } = jest.requireActual<typeof import('../maps')>('../maps');
    // Viva World School (operation 1459611) as data.texas.gov carries it.
    const line = addressLine({ address: '5853 HORIZON RD  ROCKWALL TX- 75032 7788', city: 'ROCKWALL', zip: '75032 7788' });
    expect(line).toBe('5853 HORIZON RD, ROCKWALL, TX 75032-7788');
    expect(appleMapsUrl(line)).toBe('https://maps.apple.com/?daddr=5853%20HORIZON%20RD%2C%20ROCKWALL%2C%20TX%2075032-7788');
    expect(googleMapsUrl(line)).toContain('destination=5853%20HORIZON%20RD');
  });
});

describe('tidyCase', () => {
  it('collapses the double spaces in state names', () => {
    // Operation 1304920 as data.texas.gov carries it.
    expect(tidyCase('Childrens Lighthouse of  McKinney')).toBe('Childrens Lighthouse of McKinney');
  });
});
