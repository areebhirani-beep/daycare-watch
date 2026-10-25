import { describe, expect, it } from '@jest/globals';

// Uses real records captured from data.texas.gov for operation 1358089 (Ivy Kids of Coit, McKinney).
// Derived fields the pipeline adds (category, plain) are left null here rather than invented.

import activities from '../../fixtures/op-1358089.activities.json';
import violations from '../../fixtures/op-1358089.violations.json';
import {
  agesLabel,
  daysLabel,
  fixedLabel,
  formatDate,
  hoursLabel,
  splitStandard,
  stripBoilerplate,
  tidyCase,
} from '../format';
import { groupByVisit, summarize, visibleVisits, whatChanged } from '../record';
import { buildTourQuestions } from '../tour';
import type { Finding, Inspection } from '../types';
import type { RiskLevel } from '@/theme/tokens';

const dateOf = new Map(activities.map((a) => [a.activity_id, a.activity_date]));
const typeOf = new Map(activities.map((a) => [a.activity_id, a.activity_type]));

const findings: Finding[] = violations
  .filter((v) => dateOf.has(v.activity_id))
  .map((v) => ({
    non_compliance_id: Number(v.non_compliance_id),
    activity_id: Number(v.activity_id),
    date: (dateOf.get(v.activity_id) ?? '').slice(0, 10),
    risk_level: v.standard_risk_level as RiskLevel,
    // category and plain are added by the pipeline's classifier; not under test here.
    category: 'other',
    plain: null,
    narrative: v.narrative ?? null,
    standard: v.standard_number_description,
    corrected_at_inspection: v.corrected_at_inspection === 'Y',
    corrected_date: v.corrected_date ? v.corrected_date.slice(0, 10) : null,
    verified_date: v.date_correction_verified ? v.date_correction_verified.slice(0, 10) : null,
    via_investigation: typeOf.get(v.activity_id) === 'REPORT',
    technical_assistance: v.technical_assistance_given === 'YES',
  }));

// Per-visit counts come from the same captured findings, as daycare_record computes them.
const inspections: Inspection[] = activities.map((a) => {
  const at = findings.filter((f) => f.activity_id === Number(a.activity_id));
  return {
    activity_id: Number(a.activity_id),
    date: a.activity_date.slice(0, 10),
    type: a.activity_type as Inspection['type'],
    violation_found: a.violation_found as Inspection['violation_found'],
    findings_count: at.length,
    high_count: at.filter((f) => f.risk_level === 'High').length,
    open_count: at.filter((f) => !f.corrected_at_inspection && f.verified_date === null).length,
  };
});

describe('format', () => {
  it('formats calendar dates without time zone drift', () => {
    expect(formatDate('2022-02-15T00:00:00.000')).toBe('Feb 15, 2022');
    expect(formatDate('2026-03-04')).toBe('Mar 4, 2026');
  });

  it('never treats the state corrected_date as fixed', () => {
    const now = new Date('2026-10-24T12:00:00');
    const base = { corrected_at_inspection: false, verified_date: null, date: '2026-10-05' };
    expect(fixedLabel({ ...base, corrected_at_inspection: true, corrected_date: '2026-10-05' }, now)).toBe(
      'Fixed during the visit',
    );
    expect(fixedLabel({ ...base, corrected_date: '2026-10-10', verified_date: '2026-10-20' }, now)).toBe(
      'Fixed · the state checked Oct 20',
    );
    // Real case: nc 1022378716, cited Oct 5 2026, corrected_date Oct 30 2026 (future).
    expect(fixedLabel({ ...base, corrected_date: '2026-10-30' }, now)).toBe(
      'Fix due Oct 30 · no state check on record yet',
    );
    expect(fixedLabel({ ...base, corrected_date: '2026-10-12' }, now)).toBe(
      'Fix date was Oct 12 · no state check on record yet',
    );
    expect(fixedLabel({ ...base, corrected_date: null }, now)).toBe('No fix date on record');
  });

  it('tidies only ALL CAPS source text', () => {
    expect(tidyCase('300 N. COIT RD')).toBe('300 N. Coit Rd');
    expect(tidyCase('MCKINNEY')).toBe('McKinney');
    expect(tidyCase('Ivy Kids of Coit')).toBe('Ivy Kids of Coit');
  });

  it('turns state fields into readable facts', () => {
    expect(hoursLabel('06:00 AM-06:30 PM')).toBe('6:00 AM – 6:30 PM');
    expect(daysLabel('Mon,Tue,Wed,Thu,Fri')).toBe('Mon–Fri');
    expect(agesLabel(['Infant', 'Toddler', 'Pre-Kindergarten', 'School'])).toBe(
      'Infants, toddlers, pre-K, school age',
    );
    expect(splitStandard('746.2805 - Prohibited Punishments - No Harsh, Cruel or Unusual')).toEqual({
      number: '746.2805',
      title: 'Prohibited Punishments - No Harsh, Cruel or Unusual',
    });
    expect(stripBoilerplate(
      'This standard was evaluated during the investigation and was found to be deficient. A caregiver pulled a child\'s arm.',
    )).toBe("A caregiver pulled a child's arm.");
  });
});

describe('record derivations on a real record', () => {
  it('keeps every captured finding when grouping by visit', () => {
    const visits = groupByVisit({ findings, inspections });
    const total = visits.reduce((n, v) => n + v.findings.length, 0);
    expect(total).toBe(findings.length);
    expect(visits.length).toBeGreaterThanOrEqual(inspections.length);
    for (let i = 1; i < visits.length; i++) {
      expect(visits[i - 1]!.date >= visits[i]!.date).toBe(true);
    }
  });

  it('labels visits with no findings instead of hiding them', () => {
    const visits = groupByVisit({ findings, inspections });
    const latest = visits[0]!;
    expect(latest.date).toBe('2026-10-22');
    expect(latest.status).toBe('none');
  });

  it('summarizes as counts only', () => {
    const s = summarize({ findings, inspections }, 1000, new Date('2026-10-24T12:00:00'));
    expect(s.findings).toBe(findings.length);
    expect(s.high).toBe(findings.filter((f) => f.risk_level === 'High').length);
    expect(s.lastVisit).toBe('2026-10-22');
  });

  it('hides only older visits that had no findings', () => {
    const visits = groupByVisit({ findings, inspections });
    const { shown, hiddenQuiet } = visibleVisits(visits, 24, new Date('2026-10-24T12:00:00'));
    expect(shown.length + hiddenQuiet).toBe(visits.length);
    expect(shown.filter((v) => v.status === 'findings').length).toBe(
      visits.filter((v) => v.status === 'findings').length,
    );
  });

  it('always ends tour questions with the two universal ones', () => {
    const qs = buildTourQuestions(findings, new Date('2026-10-24T12:00:00'));
    expect(qs.at(-1)?.question).toMatch(/drop in/);
    expect(qs.every((q) => !/safe|unsafe|grade|score/i.test(q.question))).toBe(true);
  });
});

describe('whatChanged', () => {
  const record = { findings, inspections };

  it('finds the visit before and the rules cited at an earlier visit', () => {
    // Sep 20, 2024 (activity 904053452) cited 746.2805(3), which the state also cited on Jun 6, 2024.
    const c = whatChanged(record, 904053452);
    expect(c.visit?.date).toBe('2024-09-20');
    expect(c.previous && c.previous.date < '2024-09-20').toBe(true);
    expect(c.repeats).toEqual([{ rule: '746.2805(3)', lastCited: '2024-06-06' }]);
  });

  it('returns nothing for a visit that is not in the record', () => {
    expect(whatChanged(record, 1)).toEqual({ visit: null, previous: null, repeats: [] });
  });
});

describe('tour questions', () => {
  it('states each fact in plain words from the captured findings', () => {
    const now = new Date('2026-10-24T12:00:00');
    const [first] = buildTourQuestions(findings, now);
    expect(first.fact).toMatch(/^The state found \d+ [a-z ]+ problems? in the past 2 years, most recently [A-Z][a-z]{2} \d{1,2}, \d{4}\./);
    expect(first.fact).not.toMatch(/finding|cited|verified/i);
    expect(first.question).toMatch(/^What changed after the [a-z ]*problem the state found on [A-Z][a-z]{2} \d{1,2}(, \d{4})?\?$/);
  });
});
