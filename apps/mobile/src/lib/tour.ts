// Tour questions built from one daycare's own findings. Facts come from the record; questions are ours.

import { formatDate, formatDateShort, isFixed, plural } from './format';
import type { Category, Finding } from './types';

const QUESTIONS: Record<Category, string> = {
  supervision: 'How do staff keep track of every child during transitions, outdoor play, and nap time?',
  background_checks: 'Is every staff member and volunteer fully background-checked before they work with children?',
  staff_ratio: 'What is the staff-to-child ratio in my child’s room, and how do you cover breaks and absences?',
  safety_hazards: 'Who checks the rooms and playground for hazards, and how often?',
  health_medication: 'How do you store and give medication, and how is each dose recorded?',
  discipline: 'What does discipline look like here, and how are staff trained on it?',
  parent_communication: 'How and how fast will you tell me about an injury or incident?',
  paperwork_admin: 'Which records do you keep on my child, and can I review them?',
  other: 'What changed after your most recent state inspection?',
};

// The kind of problem in plain words: "The state found 6 safety problems".
const KIND: Record<Category, string> = {
  supervision: 'supervision',
  background_checks: 'background check',
  staff_ratio: 'staff ratio',
  safety_hazards: 'safety',
  health_medication: 'health or medication',
  discipline: 'discipline',
  parent_communication: 'parent communication',
  paperwork_admin: 'paperwork',
  other: 'other',
};

export type TourQuestion = { category: Category | null; fact: string | null; question: string; followUp?: string };

export function buildTourQuestions(findings: Finding[], now = new Date()): TourQuestion[] {
  const cutoff = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const recent = findings.filter((f) => f.date !== null && f.date >= cutoff);
  const byCat = new Map<Category, Finding[]>();
  for (const f of recent) {
    const cat = f.category ?? 'other';
    byCat.set(cat, [...(byCat.get(cat) ?? []), f]);
  }
  const ranked = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);

  const specific: TourQuestion[] = ranked.map(([cat, list]) => {
    const latest = list.reduce((a, b) => ((b.date ?? '') > (a.date ?? '') ? b : a));
    const open = list.filter((f) => !isFixed(f)).length;
    const fact = [
      `The state found ${plural(list.length, `${KIND[cat]} problem`)} in the past 2 years, most recently ${formatDate(latest.date)}.`,
      open > 0 ? `${open} ${open === 1 ? 'has' : 'have'} no state check on record yet.` : null,
    ]
      .filter(Boolean)
      .join(' ');
    const which = cat === 'other' ? 'problem' : `${KIND[cat]} problem`;
    return {
      category: cat,
      fact,
      question: `What changed after the ${which} the state found on ${formatDateShort(latest.date, today)}?`,
      followUp: QUESTIONS[cat],
    };
  });

  const always: TourQuestion[] = [
    { category: null, fact: null, question: 'Can I see your most recent state inspection report?' },
    { category: null, fact: null, question: 'Can I drop in unannounced while my child is here?' },
  ];
  return [...specific, ...always];
}
