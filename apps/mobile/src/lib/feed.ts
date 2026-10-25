import { formatDateShort, plural, tidyCase } from './format';
import type { DistrictPulse, DistrictRecentVisit } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 12 – 18", or "Sep 29 – Oct 5" across a month. Dates come from the RPC, never from the phone's clock. */
export function weekRange(start: string, end: string): string {
  const [, sm, sd] = start.slice(0, 10).split('-').map(Number);
  const [, em, ed] = end.slice(0, 10).split('-').map(Number);
  const s = `${MONTHS[sm! - 1]} ${sd}`;
  return sm === em ? `${s} – ${ed}` : `${s} – ${MONTHS[em! - 1]} ${ed}`;
}

/**
 * The district's last complete week in one line: "Oct 12 – 18 · 12 state visits · 1 with problems posted so far".
 * District-wide, not "near you"; findings are counted as posted so far because the state keeps adding them.
 */
export function pulseLine(p: DistrictPulse): string {
  const visits = plural(p.visits, 'state visit');
  return `${weekRange(p.week_start, p.week_end)} · ${visits} · ${p.visits_with_findings.toLocaleString('en-US')} with problems posted so far`;
}

/** A visit row's name: always display_name, which is name-free for home daycares ("A Listed Family Home in Frisco"). */
export function visitName(v: Pick<DistrictRecentVisit, 'display_name'>): string {
  return tidyCase(v.display_name);
}

/** "Rockwall · Visited Oct 16" */
export function visitMeta(v: Pick<DistrictRecentVisit, 'city' | 'date'>, today: string): string {
  return [tidyCase(v.city), `Visited ${formatDateShort(v.date, today)}`].filter(Boolean).join(' · ');
}

/** "2 problems posted so far" or "No problems posted so far": results keep arriving after a visit. */
export function visitStatus(v: Pick<DistrictRecentVisit, 'findings_posted_so_far'>): string {
  return v.findings_posted_so_far > 0 ? `${plural(v.findings_posted_so_far, 'problem')} posted so far` : 'No problems posted so far';
}
