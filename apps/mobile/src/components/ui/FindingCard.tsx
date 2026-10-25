import { Pressable, StyleSheet, View } from 'react-native';

import { categoryLabel, formatDateShort, isFixed, riskLabel, splitStandard } from '@/lib/format';
import type { Finding } from '@/lib/types';
import { elevation, radius, space, useColors } from '@/theme';

import { CategoryIcon } from './CategoryIcon';
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
export function FindingCard({
  finding: f,
  visitDate,
  onOfficial,
}: {
  finding: Finding;
  visitDate?: string | null;
  /** Opens the state's own page for this daycare (every finding links to its source in one tap). */
  onOfficial?: () => void;
}) {
  const c = useColors();
  const standard = splitStandard(f.standard);
  const summary = f.plain ?? standard?.title ?? 'The state did not publish a description.';
  // "on record yet" stays together so a wrap never leaves "yet" alone.
  const fixed = plainStatus(f).replace(/ on record yet$/, ' on\u00A0record\u00A0yet');
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
  // A finding under a High-risk rule carries the page's only tag ("Serious") and an ink outline.
  const high = f.risk_level === 'High';
  return (
    <View style={[styles.card, elevation.card, { backgroundColor: c.surface, borderColor: high ? c.text : 'transparent' }, high && styles.cardHigh]}>
      <View
        accessible
        accessibilityLabel={`${high ? 'Serious. ' : ''}${categoryLabel(f.category)}. ${summary}. ${status}.`}
        style={{ gap: space.sm }}
      >
        {/* The category reads first, as a picture (CategoryIcon). */}
        <View style={styles.head}>
          <CategoryIcon category={f.category} size={32} />
          <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {categoryLabel(f.category)}
          </Text>
        </View>
        <Text variant="subhead">{summary}</Text>
        <View style={styles.status}>
          <View style={styles.statusGlyph}>
            <Glyph name={done ? 'check' : 'clock'} size={13} color={done ? c.text : c.textSecondary} weight="bold" />
          </View>
          <Text variant="callout" tone="secondary" tabular style={{ flex: 1 }}>
            {status}
          </Text>
        </View>
        {/* One line carries both our word and the state's label, so the card never says it twice. */}
        {high ? (
          <Text variant="subhead">{`Serious · ${riskLabel(f.risk_level)} rule, per the state`}</Text>
        ) : (
          <Text variant="callout" tone="tertiary">{`${riskLabel(f.risk_level)} rule, per the state`}</Text>
        )}
      </View>
      {f.narrative?.trim() ? <InspectorQuote text={f.narrative.trim()} plain={f.plain} source={rule} note={note} /> : null}
      {onOfficial ? (
        <Pressable
          onPress={onOfficial}
          accessibilityRole="link"
          accessibilityHint="Opens the state website"
          hitSlop={8}
          style={({ pressed }) => [styles.official, { borderTopColor: c.hairline }, pressed && { opacity: 0.5 }]}
        >
          <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
            View on the state’s site
          </Text>
          <Glyph name="external" size={13} color={c.textSecondary} weight="semibold" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1.5, padding: space.lg, gap: space.md },
  cardHigh: { borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pill: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
  // The glyph sits on the first line of the status, however many lines it wraps to.
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  statusGlyph: { marginTop: 4 },
  official: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: -space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
