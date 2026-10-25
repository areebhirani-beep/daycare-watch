import { Pressable, StyleSheet, View } from 'react-native';

import { categoryLabel, formatDateShort, isFixed, riskLabel, splitStandard } from '@/lib/format';
import type { Finding } from '@/lib/types';
import { elevation, radius, space, useColors } from '@/theme';

import { CategoryIcon } from './CategoryIcon';
import { Glyph } from './Glyph';
import { InspectorQuote, quotesPlain } from './Prose';
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

/** A small neutral tag for how the finding came about ("Coached", "From a report"). Never yellow, never a verdict. */
function NoteTag({ label }: { label: string }) {
  const c = useColors();
  return (
    <View style={[styles.pill, { borderWidth: 1, borderColor: c.hairline, paddingVertical: 0 }]}>
      <Text variant="footnote" tone="secondary" maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

/** The fix status in a few words for the card's one meta line: "Fix due Oct 30, not yet checked". */
function metaStatus(f: Finding): string {
  return plainStatus(f)
    .replace(' · no state check on record yet', ', not yet checked')
    .replace('Fixed · the state checked', 'Fixed, state checked');
}

/** One state finding: what was wrong in plain words, then one line with the rule, its risk level and the fix. */
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
  const summary = (f.plain ?? standard?.title ?? 'The state did not publish a description.').replace(/\s+/g, ' ');
  const status = f.date && f.date === visitDate ? metaStatus(f) : `Found ${formatDateShort(f.date)} · ${metaStatus(f)}`;
  // One meta line. "not yet checked" stays together so a wrap never leaves "checked" alone.
  const meta = [standard?.number ? `Rule ${standard.number}` : null, riskLabel(f.risk_level), status]
    .filter(Boolean)
    .join(' · ')
    .replace(/ not yet checked$/, ' not\u00A0yet\u00A0checked');
  const words = f.narrative?.trim() || null;
  // When the summary is the inspector's own sentence, a tag credits it instead of a second copy below.
  const verbatim = words != null && quotesPlain(words, f.plain);
  const tags = [
    verbatim ? 'Inspector’s words' : null,
    f.technical_assistance ? 'Coached' : null,
    f.via_investigation ? 'From a report' : null,
  ].filter((t): t is string => t != null);
  const done = isFixed(f);
  // A finding under a High-risk rule carries the page's only ink tag ("Serious") and an ink outline.
  const high = f.risk_level === 'High';
  return (
    <View style={[styles.card, elevation.card, { backgroundColor: c.surface, borderColor: high ? c.text : 'transparent' }, high && styles.cardHigh]}>
      <View
        accessible
        accessibilityLabel={`${high ? 'Serious. ' : ''}${categoryLabel(f.category)}. ${summary.replace(/[.\s]+$/, '')}. ${meta.replace(/ · /g, ', ')}.${
          tags.length ? ` ${tags.join('. ')}.` : ''
        }`}
        style={{ gap: space.sm }}
      >
        {/* The category reads first, as a picture (CategoryIcon). */}
        <View style={styles.head}>
          <CategoryIcon category={f.category} size={32} />
          <Text variant="callout" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {categoryLabel(f.category)}
          </Text>
          {high ? <SeriousTag /> : null}
        </View>
        <Text variant="subhead">{summary}</Text>
        <View style={styles.status}>
          <View style={styles.statusGlyph}>
            <Glyph name={done ? 'check' : 'clock'} size={13} color={done ? c.text : c.textSecondary} weight="bold" />
          </View>
          <Text variant="callout" tone="secondary" tabular style={{ flex: 1 }}>
            {meta}
          </Text>
        </View>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((t) => (
              <NoteTag key={t} label={t} />
            ))}
          </View>
        ) : null}
      </View>
      {words && !verbatim ? <InspectorQuote text={words} plain={f.plain} /> : null}
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
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
