import { describe, expect, it } from '@jest/globals';

import { pulseLine, visitMeta, visitName, visitStatus, weekRange, weekVisits } from '../feed';
import type { DistrictPulse, DistrictRecentVisit } from '../types';

// district_pulse() on the local database, Oct 25 2026 (last complete week Oct 12 – 18).
const pulse: DistrictPulse = {
  visits: 12,
  findings: 1,
  week_end: '2026-10-18',
  week_start: '2026-10-12',
  by_category: [{ n: 1, category: 'health_medication' }],
  findings_high: 0,
  daycares_visited: 12,
  visits_with_findings: 1,
};

// district_recent_visits(3), first row, same day.
const visit = {
  activity_id: 903901052,
  date: '2026-10-16',
  operation_id: 507034,
  name: 'Childrens Lighthouse',
  display_name: 'Childrens Lighthouse',
  city: 'ROCKWALL',
  operation_type: 'Licensed Center',
  is_home: false,
  findings_posted_so_far: 0,
  categories: [],
} as unknown as DistrictRecentVisit;

describe('feed copy', () => {
  it('names the week from the RPC dates', () => {
    expect(weekRange('2026-10-12', '2026-10-18')).toBe('Oct 12 – 18');
    expect(weekRange('2026-09-29', '2026-10-05')).toBe('Sep 29 – Oct 5');
  });

  it('says posted so far, never a ranking', () => {
    expect(pulseLine(pulse)).toBe('Oct 12 – 18 · 12 state visits · 1 with problems posted so far');
    expect(pulseLine(pulse)).not.toMatch(/safe|unsafe|grade|rank|worst|best|most/i);
  });

  it('shows a visit by display_name with city and date', () => {
    expect(visitName(visit)).toBe('Childrens Lighthouse');
    expect(visitMeta(visit, '2026-10-25')).toBe('Rockwall · Visited Oct 16');
    expect(visitStatus(visit)).toBe('No problems posted so far');
    expect(visitStatus({ findings_posted_so_far: 2 })).toBe('2 problems posted so far');
  });

  it('never shows a home by its name', () => {
    const home = { display_name: 'A Listed Family Home in Frisco', name: null };
    expect(visitName(home)).toBe('A Listed Family Home in Frisco');
  });

  it('keeps only the pulse week when the RPC runs into earlier weeks', () => {
    // district_recent_visits(50) dates around the Oct 12 – 18 week, same day.
    const rows = [{ date: '2026-10-16' }, { date: '2026-10-12' }, { date: '2026-10-10' }, { date: '2026-10-09' }];
    expect(weekVisits(rows, pulse).map((r) => r.date)).toEqual(['2026-10-16', '2026-10-12']);
  });
});
