import { describe, expect, it } from '@jest/globals';

import { plainStatus, shortStatus, visitStatus } from '../status';

// Real case: Viva World School (op 1459611), visit Oct 5 2026. nc 1022378716 was cited that day with a
// corrected_date of Oct 30 2026 (future), no fix at the inspection and no verified date.
const now = new Date('2026-10-25T12:00:00');
const nc1022378716 = { corrected_at_inspection: false, verified_date: null, corrected_date: '2026-10-30', date: '2026-10-05' };

describe('fix status copy', () => {
  it('never says Fixed for a finding with only a future corrected_date', () => {
    expect(plainStatus(nc1022378716, now)).toBe('Fix due Oct 30 · no state check on record yet');
    expect(shortStatus(nc1022378716, now)).toBe('Fix due Oct 30');
    expect(shortStatus(nc1022378716, now)).not.toMatch(/^Fixed/);
  });

  it('never says Fixed for a visit with one open finding', () => {
    const fixedAtVisit = { ...nc1022378716, corrected_at_inspection: true };
    expect(visitStatus({ status: 'findings', findings: [fixedAtVisit, nc1022378716] }, now)).toBe('Fix due Oct 30');
  });

  it('says Fixed only when every finding was corrected at the visit or verified', () => {
    const verified = { ...nc1022378716, verified_date: '2026-10-20' };
    const atVisit = { ...nc1022378716, corrected_at_inspection: true };
    expect(visitStatus({ status: 'findings', findings: [verified, atVisit] }, now)).toBe('Fixed');
    expect(plainStatus(atVisit, now)).toBe('Fixed during the visit');
    expect(plainStatus(verified, now)).toBe('Fixed · the state checked Oct 20');
  });

  it('a past corrected_date is a listed date, not a fix', () => {
    expect(plainStatus({ ...nc1022378716, corrected_date: '2026-10-12' }, now)).toBe('Fix date was Oct 12 · no state check on record yet');
  });

  it('a visit with no findings says what the state did', () => {
    expect(visitStatus({ status: 'none', findings: [] }, now)).toBe('No problems cited');
    expect(visitStatus({ status: 'pending', findings: [] }, now)).toBe('Not posted yet');
  });
});
