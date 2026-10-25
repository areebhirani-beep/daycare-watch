import { describe, expect, it } from '@jest/globals';

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
