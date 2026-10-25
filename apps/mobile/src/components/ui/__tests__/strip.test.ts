import { describe, expect, it } from '@jest/globals';

import { stripSentence, type StripVisit } from '../strip';

const visit = (id: number, marks: StripVisit['marks'], self = false): StripVisit => ({ id, date: '2026-09-29', marks, self });

describe('stripSentence', () => {
  it('counts state visits only as visits', () => {
    expect(stripSentence([visit(1, [{ rank: 5, open: false }]), visit(2, [])], 24)).toBe(
      '2 state visits in the last 24 months. 1 finding from 1 visit. 1 on a High risk rule.',
    );
  });

  it("names a self-report as the daycare's own report, never a state visit", () => {
    const s = stripSentence([visit(1, []), visit(2, [{ rank: 3, open: true }], true)], 24);
    expect(s).toBe(
      "1 state visit and 1 report by the daycare itself in the last 24 months. 1 finding from 1 of them. 1 not yet verified by the state.",
    );
  });
});
