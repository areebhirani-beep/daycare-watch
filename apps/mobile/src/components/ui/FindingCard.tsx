import { StyleSheet, View } from 'react-native';

import { categoryLabel, fixedLabel, formatDate, isFixed, riskLabel, splitStandard } from '@/lib/format';
import type { Finding } from '@/lib/types';
import { radius, space, useColors } from '@/theme';

import { Glyph } from './Glyph';
import { InspectorQuote } from './Prose';
import { Text } from './Text';

/** Seriousness as a small swatch + words. The words carry the meaning; the swatch only points at it. */
export function RiskTag({ level }: { level: Finding['risk_level'] }) {
  const c = useColors();
  return (
    <View style={styles.tag}>
      <View style={[styles.swatch, { backgroundColor: c.risk[level] }]} />
      <Text variant="subhead" color={c.risk[level]}>
        {riskLabel(level)}
      </Text>
    </View>
  );
}

/** One state finding as a card: seriousness, plain words, fixed status, the inspector's words. */
export function FindingCard({ finding: f, visitDate }: { finding: Finding; visitDate?: string | null }) {
  const c = useColors();
  const standard = splitStandard(f.standard);
  const summary = f.plain ?? standard?.title ?? 'The state did not publish a description.';
  const fixed = fixedLabel(f);
  const status = f.date && f.date === visitDate ? fixed : `Cited ${formatDate(f.date)} · ${fixed}`;
  const rule = standard?.number ? `Rule ${standard.number}` : null;
  const note =
    [
      f.via_investigation ? 'Found during an investigation of a report, not a routine inspection.' : null,
      f.technical_assistance ? 'The inspector gave the daycare technical assistance on this rule.' : null,
    ]
      .filter(Boolean)
      .join(' ') || null;
  const done = isFixed(f);
  // A finding on a High-risk rule carries more weight on the page: an ink header and a bigger line.
  const high = f.risk_level === 'High';
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: high ? c.text : c.hairline }, high && styles.cardHigh]}>
      {high ? (
        <View style={[styles.highBar, { backgroundColor: c.text }]}>
          <View style={[styles.swatch, { backgroundColor: c.risk.High, borderWidth: 1.5, borderColor: c.surface }]} />
          <Text variant="subhead" color={c.surface} style={{ fontWeight: '700' }}>
            High-risk rule
          </Text>
          <Text variant="footnote" color={c.surface} numberOfLines={1} style={{ flexShrink: 1, opacity: 0.75 }}>
            {categoryLabel(f.category)}
          </Text>
        </View>
      ) : null}
      <View
        accessible
        accessibilityLabel={`${riskLabel(f.risk_level)} rule. ${categoryLabel(f.category)}. ${summary}. ${status}.`}
        style={{ gap: space.sm }}
      >
        {high ? null : (
          <View style={styles.top}>
            <RiskTag level={f.risk_level} />
            <Text variant="footnote" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {categoryLabel(f.category)}
            </Text>
          </View>
        )}
        <Text variant={high ? 'title' : 'headline'}>{summary}</Text>
        <View style={styles.status}>
          <Glyph name={done ? 'check' : 'clock'} size={12} color={done ? c.text : c.textSecondary} weight="bold" />
          <Text variant="footnote" tone="secondary" tabular style={{ flex: 1 }}>
            {status}
          </Text>
        </View>
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
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
