import { StyleSheet, View } from 'react-native';

import { categoryLabel, formatDateShort, isFixed, riskLabel, splitStandard } from '@/lib/format';
import type { Finding } from '@/lib/types';
import { radius, space, useColors } from '@/theme';

import { Glyph } from './Glyph';
import { InspectorQuote } from './Prose';
import { plainStatus } from './status';
import { Text } from './Text';

export { plainStatus, shortStatus } from './status';

/** The one tag the record carries: a small ink pill on findings under a rule the state rates High risk. */
export function SeriousTag() {
  const c = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: c.text }]}>
      <Text variant="subhead" color={c.surface} maxFontSizeMultiplier={1.4}>
        Serious
      </Text>
    </View>
  );
}

/** One state finding: what was wrong in plain words, whether it's fixed, the inspector's words. */
export function FindingCard({ finding: f, visitDate }: { finding: Finding; visitDate?: string | null }) {
  const c = useColors();
  const standard = splitStandard(f.standard);
  const summary = f.plain ?? standard?.title ?? 'The state did not publish a description.';
  const fixed = plainStatus(f);
  const status = f.date && f.date === visitDate ? fixed : `Found ${formatDateShort(f.date)} · ${fixed}`;
  const rule = standard?.number ? `Rule ${standard.number}` : null;
  const note =
    [
      f.via_investigation ? 'Found while looking into a report, not on a routine inspection.' : null,
      f.technical_assistance ? 'The inspector showed the daycare how to meet this rule.' : null,
    ]
      .filter(Boolean)
      .join(' ') || null;
  const done = isFixed(f);
  // A finding under a High-risk rule carries the page's only tag: an ink header that says "Serious".
  const high = f.risk_level === 'High';
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: high ? c.text : c.hairline }, high && styles.cardHigh]}>
      {high ? (
        <View style={[styles.highBar, { backgroundColor: c.text }]}>
          <Text variant="subhead" color={c.surface}>
            Serious
          </Text>
          <Text variant="callout" color={c.surface} numberOfLines={1} style={{ flexShrink: 1, opacity: 0.7 }}>
            {categoryLabel(f.category)}
          </Text>
        </View>
      ) : null}
      <View
        accessible
        accessibilityLabel={`${high ? 'Serious. ' : ''}${categoryLabel(f.category)}. ${summary}. ${status}.`}
        style={{ gap: space.xs }}
      >
        {high ? null : (
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            {categoryLabel(f.category)}
          </Text>
        )}
        <Text variant="subhead">{summary}</Text>
        <View style={styles.status}>
          <Glyph name={done ? 'check' : 'clock'} size={13} color={done ? c.text : c.textSecondary} weight="bold" />
          <Text variant="callout" tone="secondary" tabular style={{ flex: 1 }}>
            {status}
          </Text>
        </View>
        {/* "Serious" is our word; the state's own label stays on the finding (integrator, Oct 25). */}
        <Text variant="callout" tone="tertiary">{`${riskLabel(f.risk_level)} rule, per the state`}</Text>
      </View>
      {f.narrative?.trim() ? <InspectorQuote text={f.narrative.trim()} plain={f.plain} source={rule} note={note} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md, overflow: 'hidden' },
  cardHigh: { borderWidth: 1.5, paddingTop: 0 },
  highBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: -space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
  },
  pill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
