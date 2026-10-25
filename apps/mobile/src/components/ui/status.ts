import { formatDateShort, isFixed } from '@/lib/format';
import type { Finding } from '@/lib/types';

// Fix status in plain words. Pure, so the copy is tested without a device.
// "Fixed" only ever comes from corrected_at_inspection or verified_date, never from corrected_date:
// that column is a due date (124 in-scope findings carry a future one).

type FixFields = Pick<Finding, 'corrected_at_inspection' | 'corrected_date' | 'verified_date' | 'date'>;

function todayIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The full line on a finding: "Fix due Oct 30 · no state check on record yet". */
export function plainStatus(f: FixFields, now: Date = new Date()): string {
  if (f.corrected_at_inspection) return 'Fixed during the visit';
  if (f.verified_date) return `Fixed · the state checked ${formatDateShort(f.verified_date, f.date)}`;
  if (f.corrected_date) {
    const when = formatDateShort(f.corrected_date, f.date);
    return f.corrected_date.slice(0, 10) >= todayIso(now)
      ? `Fix due ${when} · no state check on record yet`
      : `Fix date was ${when} · no state check on record yet`;
  }
  return 'No fix date on record';
}

/** The short version for rows: never a bare "Fixed", always how it was fixed. */
export function shortStatus(f: FixFields, now: Date = new Date()): string {
  if (f.corrected_at_inspection) return 'Fixed during the visit';
  if (f.verified_date) return 'Fixed · state checked';
  if (f.corrected_date) {
    const when = formatDateShort(f.corrected_date, todayIso(now));
    return f.corrected_date.slice(0, 10) >= todayIso(now) ? `Fix due ${when}` : `Fix date was ${when}`;
  }
  return 'No fix date';
}

/** The open finding with the latest fix date speaks for a visit. */
export function latestOpen<T extends FixFields>(findings: T[]): T | null {
  const open = findings.filter((f) => !isFixed(f));
  if (open.length === 0) return null;
  return open.reduce((a, b) => ((b.corrected_date ?? '') > (a.corrected_date ?? '') ? b : a));
}

/**
 * One visit's status: fixed only when every finding from it is. All fixed at the visit says so; otherwise
 * at least one was checked by the state afterwards (and the rest the inspector saw fixed), so "state checked".
 */
export function visitStatus(v: { status: 'findings' | 'none' | 'pending'; findings: FixFields[] }, now: Date = new Date()): string {
  if (v.status === 'pending') return 'Not posted yet';
  if (v.findings.length === 0) return 'No problems cited';
  const open = latestOpen(v.findings);
  if (open) return shortStatus(open, now);
  return v.findings.every((f) => f.corrected_at_inspection) ? 'Fixed during the visit' : 'Fixed · state checked';
}
