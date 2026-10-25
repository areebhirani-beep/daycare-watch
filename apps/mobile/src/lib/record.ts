// Pure derivations over a daycare_record payload. Counts and dates only, never a verdict.

import { isFixed, parseDay, splitStandard } from './format';
import type { DaycareRecord, Finding, Inspection } from './types';

export type Visit = {
  activity_id: number;
  date: string;
  type: string;
  status: 'findings' | 'none' | 'pending';
  findings: Finding[];
};

function monthsAgo(iso: string, months: number, now: Date): boolean {
  const p = parseDay(iso);
  if (!p) return false;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return new Date(p.y, p.m, p.d) >= cutoff;
}

/** Joins findings to their visit, newest first. Visits with no findings stay in, labelled. */
export function groupByVisit(record: Pick<DaycareRecord, 'findings' | 'inspections'>): Visit[] {
  const byActivity = new Map<number, Finding[]>();
  for (const f of record.findings) {
    const list = byActivity.get(f.activity_id) ?? [];
    list.push(f);
    byActivity.set(f.activity_id, list);
  }
  const visits: Visit[] = record.inspections.map((i: Inspection) => {
    const findings = byActivity.get(i.activity_id) ?? [];
    byActivity.delete(i.activity_id);
    const status: Visit['status'] =
      findings.length > 0 ? 'findings' : i.violation_found === 'Pending' ? 'pending' : 'none';
    return { activity_id: i.activity_id, date: i.date, type: i.type, status, findings };
  });
  // Findings whose visit row is missing still show, dated by the finding itself.
  for (const [activity_id, findings] of byActivity) {
    const first = findings[0];
    if (!first) continue;
    visits.push({
      activity_id,
      date: first.date ?? '',
      type: first.via_investigation ? 'REPORT' : 'INSPECTION',
      status: 'findings',
      findings,
    });
  }
  visits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.activity_id - a.activity_id));
  return visits;
}

export function visitTypeLabel(type: string): string {
  switch (type) {
    case 'INSPECTION':
      return 'Inspection';
    case 'REPORT':
      return 'Investigation of a report';
    case 'ASSESSMENT':
      return 'Assessment';
    default:
      return 'State visit';
  }
}

export type Summary = {
  months: number;
  visits: number;
  visitsWithFindings: number;
  findings: number;
  high: number;
  notFixed: number;
  repeatedRules: number;
  lastVisit: string | null;
};

export function summarize(record: Pick<DaycareRecord, 'findings' | 'inspections'>, months = 24, now = new Date()): Summary {
  const recentVisits = record.inspections.filter((i) => monthsAgo(i.date, months, now));
  const recent = record.findings.filter((f) => f.date !== null && monthsAgo(f.date, months, now));
  const ruleCounts = new Map<string, number>();
  for (const f of recent) {
    if (f.standard) ruleCounts.set(f.standard, (ruleCounts.get(f.standard) ?? 0) + 1);
  }
  const lastVisit = record.inspections.reduce<string | null>(
    (latest, i) => (latest === null || i.date > latest ? i.date : latest),
    null,
  );
  return {
    months,
    visits: recentVisits.length,
    visitsWithFindings: new Set(recent.map((f) => f.activity_id)).size,
    findings: recent.length,
    high: recent.filter((f) => f.risk_level === 'High').length,
    notFixed: recent.filter((f) => !isFixed(f)).length,
    repeatedRules: [...ruleCounts.values()].filter((n) => n > 1).length,
    lastVisit,
  };
}

/** Recent visits in full; older visits only when they had findings. */
export function visibleVisits(visits: Visit[], months = 24, now = new Date()): { shown: Visit[]; hiddenQuiet: number } {
  const shown: Visit[] = [];
  let hiddenQuiet = 0;
  for (const v of visits) {
    if (monthsAgo(v.date, months, now) || v.status === 'findings') shown.push(v);
    else hiddenQuiet += 1;
  }
  return { shown, hiddenQuiet };
}

export type Segment = { kind: 'visit'; visit: Visit } | { kind: 'quiet'; visits: Visit[] };

/** Collapses consecutive visits with no findings into one block, so findings stay easy to scan. */
export function segments(visits: Visit[]): Segment[] {
  const out: Segment[] = [];
  for (const v of visits) {
    const last = out[out.length - 1];
    if (v.status === 'none') {
      if (last?.kind === 'quiet') last.visits.push(v);
      else out.push({ kind: 'quiet', visits: [v] });
    } else {
      out.push({ kind: 'visit', visit: v });
    }
  }
  return out;
}

export type Change = {
  /** The visit the alert is about. */
  visit: Visit | null;
  /** The state visit just before it, of any outcome. */
  previous: Visit | null;
  /** Rules cited at this visit that the state also cited at an earlier visit, with the latest earlier date. */
  repeats: { rule: string; lastCited: string }[];
};

/** What a visit adds to the record: the visit before it, and which of its rules were cited before. */
export function whatChanged(record: Pick<DaycareRecord, 'findings' | 'inspections'>, activityId: number): Change {
  const visits = groupByVisit(record); // newest first
  const i = visits.findIndex((v) => v.activity_id === activityId);
  if (i < 0) return { visit: null, previous: null, repeats: [] };
  const visit = visits[i] ?? null;
  const earlier = visits.slice(i + 1).filter((v) => v.date && visit && v.date < visit.date);
  const ruleOf = (f: Finding) => splitStandard(f.standard)?.number || null;
  const repeats: Change['repeats'] = [];
  for (const rule of new Set((visit?.findings ?? []).map(ruleOf).filter((r): r is string => Boolean(r)))) {
    const before = earlier.find((v) => v.findings.some((f) => ruleOf(f) === rule));
    if (before) repeats.push({ rule, lastCited: before.date });
  }
  return { visit, previous: earlier[0] ?? null, repeats };
}
