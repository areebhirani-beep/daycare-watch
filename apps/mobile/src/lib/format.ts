import type { RiskLevel } from '@/theme/tokens';

import type { Category, Finding } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parses an ISO date or timestamp as a calendar date, ignoring time zones. */
export function parseDay(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

/** "Mar 4, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = parseDay(iso);
  if (!p) return '';
  return `${MONTHS[p.m]} ${p.d}, ${p.y}`;
}

/** A timestamp as the parent's local calendar day, "Oct 24, 2026". An ISO timestamp's own date part is UTC. */
export function formatLocalDay(ts: string | null | undefined): string {
  if (!ts) return '';
  const t = new Date(ts);
  if (Number.isNaN(t.getTime())) return '';
  return `${MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`;
}

/** "Mar 12" when same year as `ref`, otherwise "Mar 12, 2025" */
export function formatDateShort(iso: string | null | undefined, ref?: string | null): string {
  if (!iso) return '';
  const p = parseDay(iso);
  if (!p) return '';
  const r = ref ? parseDay(ref) : null;
  return r && r.y === p.y ? `${MONTHS[p.m]} ${p.d}` : `${MONTHS[p.m]} ${p.d}, ${p.y}`;
}

/** "March 2026" */
export function formatMonthYear(iso: string): string {
  const p = parseDay(iso);
  return p ? `${MONTHS_LONG[p.m]} ${p.y}` : '';
}

/** "Today at 9:14 AM", "Yesterday at 9:14 AM", or "Oct 21 at 9:14 AM" for a timestamp. */
export function formatCheckedAt(ts: string | null | undefined, now: Date = new Date()): string {
  if (!ts) return 'not yet';
  const t = new Date(ts);
  if (Number.isNaN(t.getTime())) return 'not yet';
  const h = t.getHours();
  const time = `${((h + 11) % 12) + 1}:${String(t.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(t)) / 86_400_000);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  return `${MONTHS[t.getMonth()]} ${t.getDate()} at ${time}`;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  supervision: 'Supervision',
  background_checks: 'Background checks',
  staff_ratio: 'Staff-to-child ratio',
  safety_hazards: 'Safety hazards',
  health_medication: 'Health & medication',
  discipline: 'Discipline',
  parent_communication: 'Parent communication',
  paperwork_admin: 'Paperwork',
  other: 'Other',
};

export function categoryLabel(c: Category | null | undefined): string {
  return c ? CATEGORY_LABEL[c] : 'Other';
}

/** The state's own risk words, as a short label: "High risk". */
export function riskLabel(level: RiskLevel): string {
  return `${level} risk`;
}

export const RISK_EXPLAINER =
  'Texas rates every rule it inspects from Low to High by how much risk breaking that rule poses to children. The level belongs to the rule, not to the daycare.';

function todayIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * The state's corrected_date behaves like a due date (it can be in the future), so it never reads as "Fixed".
 * Only a correction at the inspection or a state verification counts as fixed (CONTRACT 3).
 */
export function fixedLabel(
  f: Pick<Finding, 'corrected_at_inspection' | 'corrected_date' | 'verified_date' | 'date'>,
  now: Date = new Date(),
): string {
  if (f.corrected_at_inspection) return 'Corrected during the inspection';
  if (f.verified_date) return `State verified the fix ${formatDateShort(f.verified_date, f.date)}`;
  if (f.corrected_date) {
    const when = formatDateShort(f.corrected_date, f.date);
    return f.corrected_date.slice(0, 10) >= todayIso(now)
      ? `Fix due ${when} · not yet verified by the state`
      : `Fix date listed ${when} · not yet verified by the state`;
  }
  return 'No fix date on record';
}

export function isFixed(f: Pick<Finding, 'corrected_at_inspection' | 'verified_date'>): boolean {
  return Boolean(f.corrected_at_inspection || f.verified_date);
}

const OPERATION_TYPE: Record<string, string> = {
  'Licensed Center': 'Licensed child care center',
  'Licensed Child-Care Home': 'Licensed child-care home',
  'Listed Family Home': 'Listed family home',
  'Registered Child-Care Home': 'Registered child-care home',
};

export function operationTypeLabel(t: string | null | undefined): string {
  if (!t) return '';
  return OPERATION_TYPE[t] ?? t;
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'at', 'in', 'on', 'for', 'a', 'an', 'to', 'by']);
const KEEP_UPPER = new Set(['TX', 'LLC', 'YMCA', 'ISD', 'II', 'III', 'IV', 'NE', 'NW', 'SE', 'SW', 'FM', 'US', 'CR', 'PO']);

/** Title-cases text only when the source gave it in ALL CAPS. */
export function tidyCase(raw: string | null | undefined): string {
  // State names carry stray double spaces ("Childrens Lighthouse of  McKinney"); show single ones.
  const s = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s;
  return s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((w, i) => {
      const up = w.toUpperCase();
      if (KEEP_UPPER.has(up.replace(/[.,]/g, ''))) return up;
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('');
}

const AGE_LABEL: Record<string, string> = {
  Infant: 'infants',
  Toddler: 'toddlers',
  'Pre-Kindergarten': 'pre-K',
  School: 'school age',
};

/** ["Infant","Toddler"] → "Infants, toddlers" */
export function agesLabel(ages: string[] | null | undefined): string {
  if (!ages || ages.length === 0) return '';
  const s = ages.map((a) => AGE_LABEL[a.trim()] ?? a.trim().toLowerCase()).join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "06:00 AM-06:30 PM" → "6:00 AM – 6:30 PM" */
export function hoursLabel(h: string | null | undefined): string {
  if (!h) return '';
  return h
    .replace(/\b0(\d:)/g, '$1')
    .replace(/\s*-\s*/, ' – ')
    .trim();
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Mon,Tue,Wed,Thu,Fri" → "Mon–Fri" */
export function daysLabel(d: string[] | string | null | undefined): string {
  if (!d) return '';
  const days = (Array.isArray(d) ? d : d.split(',')).map((x) => x.trim()).filter(Boolean);
  const idx = days.map((x) => DAY_ORDER.indexOf(x));
  const contiguous =
    idx.every((i) => i >= 0) && idx.every((v, i) => i === 0 || v === (idx[i - 1] ?? -2) + 1);
  if (contiguous && days.length > 2) return `${days[0]}–${days[days.length - 1]}`;
  return days.join(', ');
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** The narrative often opens with boilerplate; the plain summary carries the point. */
export function stripBoilerplate(narrative: string): string {
  return narrative
    .replace(/^This standard was evaluated during the (investigation|inspection) and was found to be deficient\.\s*/i, '')
    .trim();
}

/** "746.2805 - Prohibited Punishments - No Harsh, Cruel or Unusual" → number + title */
export function splitStandard(s: string | null | undefined): { number: string; title: string } | null {
  if (!s) return null;
  const m = /^([\d.()a-zA-Z]+)\s*-\s*(.+)$/.exec(s.trim());
  if (!m) return { number: '', title: s.trim() };
  return { number: m[1] ?? '', title: (m[2] ?? '').trim() };
}
