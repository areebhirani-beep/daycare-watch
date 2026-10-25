import { StyleSheet, View } from 'react-native';

import { InspectorQuote } from '@/components/ui/Serif';
import { categoryLabel, fixedLabel, formatDate, riskLabel, splitStandard } from '@/lib/format';
import type { Finding } from '@/lib/types';
import { space, useColors } from '@/theme';

import { RiskMarks } from './RiskMarks';
import { T } from './T';

/**
 * One state finding: seriousness in words, plain summary first, inspector's words quoted below.
 * Under a visit header pass `visitDate`; the cited date is then left out when it is the same day.
 */
export function FindingRow({ finding: f, visitDate }: { finding: Finding; visitDate?: string | null }) {
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

  const spoken = [
    `${riskLabel(f.risk_level)} rule. ${categoryLabel(f.category)}. ${summary}`,
    standard?.title && summary !== standard.title ? `Rule: ${standard.title}.` : null,
    `${status}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={styles.wrap}>
      <View accessible accessibilityLabel={spoken} style={styles.body}>
        <View style={styles.meta}>
          <RiskMarks level={f.risk_level} />
          <T variant="subhead" color={c.risk[f.risk_level]}>
            {riskLabel(f.risk_level)}
          </T>
          <T variant="footnote" tone="secondary">
            {categoryLabel(f.category)}
          </T>
        </View>
        <T variant="body">{summary}</T>
        {standard?.title && summary !== standard.title ? (
          <T variant="footnote" tone="secondary">
            Rule: {standard.title}
          </T>
        ) : null}
        <T variant="footnote" tone="secondary" tabular>
          {status}
        </T>
      </View>

      {f.narrative?.trim() ? (
        <InspectorQuote text={f.narrative.trim()} plain={f.plain} source={rule} note={note} />
      ) : rule || note ? (
        <T variant="footnote" tone="secondary">
          {['The state did not publish the inspector’s words.', rule, note].filter(Boolean).join(' ')}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  body: { gap: space.xs + 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
});
