import { isFixed, parseDay } from '@/lib/format';
import { groupByVisit } from '@/lib/record';
import type { DaycareRecord } from '@/lib/types';
import { riskRank } from '@/theme/tokens';

// The record strip's data and words, kept free of drawing code so they test without a native runtime.

export type Rank = 1 | 2 | 3 | 4 | 5;
export type StripMark = { rank: Rank; open: boolean };
/** self: the daycare reported it to the state itself; it is never called a state visit. */
export type StripVisit = { id: string | number; date: string; marks: StripMark[]; pending?: boolean; self?: boolean };

/** One entry of DaycareRow.visits_24mo (platform, oldest first). r = risk ranks desc, o = 1 when not yet verified. */
export type RowVisit = { d: string; n?: number; r: number[]; o: number[] };

function toRank(n: number): Rank {
  return (n >= 5 ? 5 : n <= 1 ? 1 : Math.round(n)) as Rank;
}

/** From a full daycare_record payload. */
export function stripFromRecord(record: Pick<DaycareRecord, 'findings' | 'inspections'>): StripVisit[] {
  return groupByVisit(record).map((v) => ({
    id: v.activity_id,
    date: v.date,
    pending: v.status === 'pending',
    self: v.selfReport,
    marks: v.findings.map((f) => ({ rank: riskRank[f.risk_level], open: !isFixed(f) })),
  }));
}

/** From the compact per-row summary (DaycareRow.visits_24mo). */
export function stripFromRow(visits: RowVisit[] | null | undefined): StripVisit[] {
  return (visits ?? []).map((v, i) => ({
    id: `${v.d}-${i}`,
    date: v.d,
    marks: v.r.map((r, j) => ({ rank: toRank(r), open: v.o[j] === 1 })),
  }));
}

export function dayValue(iso: string): number | null {
  const p = parseDay(iso);
  return p ? new Date(p.y, p.m, p.d).getTime() : null;
}

/** Spoken summary, so a screen reader gets the whole picture in one sentence. */
export function stripSentence(visits: StripVisit[], months: number): string {
  const all = visits.flatMap((v) => v.marks);
  const withFindings = visits.filter((v) => v.marks.length > 0).length;
  const high = all.filter((m) => m.rank === 5).length;
  const open = all.filter((m) => m.open).length;
  if (visits.length === 0) return `No state visits posted in the last ${months} months.`;
  const own = visits.filter((v) => v.self).length;
  const state = visits.length - own;
  const ownPart = own > 0 ? ` and ${own} ${own === 1 ? 'report' : 'reports'} by the daycare itself` : '';
  const parts = [`${state} state ${state === 1 ? 'visit' : 'visits'}${ownPart} in the last ${months} months.`];
  if (all.length === 0) parts.push('No findings posted.');
  else {
    const from = own > 0 ? `${withFindings} of them` : `${withFindings} ${withFindings === 1 ? 'visit' : 'visits'}`;
    parts.push(`${all.length} ${all.length === 1 ? 'finding' : 'findings'} from ${from}.`);
    if (high > 0) parts.push(`${high} on a High risk rule.`);
    if (open > 0) parts.push(`${open} not yet verified by the state.`);
  }
  return parts.join(' ');
}
