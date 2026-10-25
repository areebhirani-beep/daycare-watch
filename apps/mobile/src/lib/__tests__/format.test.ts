import { describe, expect, it, jest } from '@jest/globals';

import { formatLocalDay } from '../format';

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
    const line = addressLine({ address: '1120 E Ralph Hall Pkwy', city: 'ROCKWALL', zip: '75032' });
    expect(line).toBe('1120 E Ralph Hall Pkwy, ROCKWALL, TX 75032');
    expect(appleMapsUrl(line)).toBe('https://maps.apple.com/?daddr=1120%20E%20Ralph%20Hall%20Pkwy%2C%20ROCKWALL%2C%20TX%2075032');
    expect(googleMapsUrl(line)).toContain('destination=1120%20E%20Ralph%20Hall%20Pkwy');
  });
});
