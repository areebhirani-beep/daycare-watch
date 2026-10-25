// Every claim here traces to docs/OFFICIAL_SOURCES.md section 2 (verified Oct 24 2026).
// Quoted phrases are the statute's own words from Texas Human Resources Code §42.04271.

import type { GlyphName } from '@/components/ui/Glyph';

export const LAW_CITE = 'Texas Human Resources Code §42.04271';
export const LAW_NAME = 'Kairo and the Kids’ Law (88(R) SB 1098, 2023)';

export const LAW_SCOPE =
  'Applies to day-care centers, group day-care homes, before- and after-school programs, school-age programs, and registered family homes. In effect since September 1, 2023.';

export type Right = { id: string; clause: string; title: string; plain: string; quote: string };

export const RIGHTS: Right[] = [
  {
    id: 'visit',
    clause: '(b)(1)',
    title: 'Drop in any time they’re open',
    plain: 'You can walk in and look around during operating hours without calling ahead.',
    quote: 'enter and examine the child-care facility during the facility’s hours of operation without advance notice',
  },
  {
    id: 'records',
    clause: '(b)(4)',
    title: 'See your child’s records',
    plain: 'You can review the written records the daycare keeps about your child.',
    quote: 'review the child-care facility’s written records concerning the parent’s or guardian’s child',
  },
  {
    id: 'reports',
    clause: '(b)(5)',
    title: 'Get the state’s inspection reports',
    plain: 'The daycare must give you the state’s inspection reports.',
    quote: 'receive from the child-care facility the commission’s inspection reports',
  },
  {
    id: 'video',
    clause: '(b)(8)',
    title: 'Inspect video of an alleged incident',
    plain:
      'If your child was involved in an alleged incident of abuse or neglect and video of it exists, you can inspect it. You can’t keep footage that shows other children, and other parents are notified first. The law does not require cameras.',
    quote: 'inspect any video recordings of an alleged incident of abuse or neglect involving the parent’s or guardian’s child',
  },
  {
    id: 'policies',
    clause: '(b)(9)',
    title: 'Get a copy of their policies',
    plain: 'You can get a copy of the daycare’s policies and procedures.',
    quote: 'obtain a copy of the child-care facility’s policies and procedures',
  },
  {
    id: 'training',
    clause: '(b)(10)',
    title: 'Review staff training records',
    plain: 'If you ask, you can review staff training records and the daycare’s own curriculum.',
    quote: 'review, on the request of the parent or guardian, the facility’s: (A) staff training records',
  },
  {
    id: 'complain',
    clause: '(b)(2)',
    title: 'File a complaint',
    plain: 'You can file a complaint against the daycare with the state.',
    quote: 'file a complaint against the child-care facility',
  },
  {
    id: 'retaliation',
    clause: '(b)(11)',
    title: 'No retaliation',
    plain: 'The daycare may not punish you or your child for using any of these rights.',
    quote:
      'be free from any retaliatory action by the child-care facility for exercising any of the parent’s or guardian’s rights',
  },
];

export const FEDERAL_NOTE =
  'Rep. Pat Fallon’s Kairo Act (H.R. 2425) would bring a similar parent bill of rights to child care programs that receive federal funds, with a 2-business-day deadline for access to incident video. It was introduced March 27, 2025 and is not law.';

export type RequestKind = 'records' | 'video' | 'visit';

/** Official text of the code chapter that holds the section. */
export const LAW_URL = 'https://statutes.capitol.texas.gov/Docs/HR/htm/HR.42.htm';

/** The three requests a parent can send, as cards (Rights tab and the place page). */
export const REQUEST_CARDS: { kind: RequestKind; icon: GlyphName; title: string; detail: string }[] = [
  { kind: 'records', icon: 'doc', title: 'Request records', detail: 'Your child’s records and the inspection reports' },
  { kind: 'visit', icon: 'clock', title: 'Drop in any time', detail: 'A note citing the law, for the front desk' },
  { kind: 'video', icon: 'shield', title: 'Ask to inspect video', detail: 'Only after an alleged abuse or neglect incident involving your child' },
];

export function requestText(kind: RequestKind, daycare: string | null): { subject: string; body: string } {
  const at = daycare ?? '[daycare name]';
  switch (kind) {
    case 'records':
      return {
        subject: `Records request under ${LAW_CITE}`,
        body: [
          `Dear Director,`,
          ``,
          `Under ${LAW_CITE} (${LAW_NAME}), I am asking to:`,
          ``,
          `- review ${at}'s written records concerning my child, [child's name];`,
          `- receive the Texas Health and Human Services Commission's inspection reports for ${at};`,
          `- obtain a copy of ${at}'s policies and procedures;`,
          `- review staff training records and the in-house curriculum.`,
          ``,
          `Please let me know when I can review these. Thank you.`,
          ``,
          `[Your name]`,
          `[Phone]`,
        ].join('\n'),
      };
    case 'video':
      return {
        subject: `Request to inspect video under ${LAW_CITE}(b)(8)`,
        body: [
          `Dear Director,`,
          ``,
          `Under ${LAW_CITE}(b)(8) (${LAW_NAME}), I am asking to inspect any video recordings of the alleged incident involving my child, [child's name], at ${at} on [date] at about [time].`,
          ``,
          `I understand I may not keep footage that shows other children, and that other parents may be notified first. Please tell me whether recordings of this incident are available and when I can inspect them.`,
          ``,
          `Thank you,`,
          `[Your name]`,
          `[Phone]`,
        ].join('\n'),
      };
    case 'visit':
      return {
        subject: `Parent right to visit under ${LAW_CITE}(b)(1)`,
        body: [
          `${LAW_CITE}(b)(1) (${LAW_NAME}) gives a parent or guardian the right to "enter and examine the child-care facility during the facility's hours of operation without advance notice."`,
          ``,
          `I am the parent of [child's name], enrolled at ${at}, and I would like to visit now.`,
        ].join('\n'),
      };
  }
}
