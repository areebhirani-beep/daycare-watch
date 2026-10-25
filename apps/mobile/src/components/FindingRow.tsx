import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  categoryLabel,
  fixedLabel,
  formatDate,
  riskLabel,
  splitStandard,
} from '@/lib/format';
import type { Finding } from '@/lib/types';
import { minTap, radius, space, useColors } from '@/theme';

import { Icon } from './Icon';
import { RiskMarks } from './RiskMarks';
import { T } from './T';

/** One state finding: seriousness in words, plain summary first, inspector's words one tap away. */
export function FindingRow({ finding: f, defaultOpen = false }: { finding: Finding; defaultOpen?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const standard = splitStandard(f.standard);
  const summary = f.plain ?? standard?.title ?? 'The state did not publish a description.';
  const fixed = fixedLabel(f);
  const status = `Cited ${formatDate(f.date)} · ${fixed}`;

  const spoken = `${riskLabel(f.risk_level)} rule. ${categoryLabel(f.category)}. ${summary} ${status}.`;

  return (
    <View style={styles.wrap}>
      <View accessible accessibilityLabel={spoken} style={styles.body}>
        <View style={styles.meta}>
          <RiskMarks level={f.risk_level} />
          <T variant="subhead" color={c.risk[f.risk_level]}>
            {riskLabel(f.risk_level)}
          </T>
          <T variant="footnote" tone="secondary">
            · {categoryLabel(f.category)}
          </T>
        </View>
        <T variant="body">{summary}</T>
        <T variant="footnote" tone="secondary" tabular>
          {status}
        </T>
      </View>

      {f.narrative || standard ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? "Hide the inspector's words" : "Read the inspector's words"}
          onPress={() => setOpen((v) => !v)}
          hitSlop={4}
          style={styles.toggle}
        >
          <T variant="subhead" tone="accent">
            Inspector&rsquo;s words
          </T>
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
            <Icon name="chevronDown" size={12} color={c.accent} weight="semibold" />
          </View>
        </Pressable>
      ) : null}

      {open ? (
        <View style={[styles.quote, { backgroundColor: c.sunken, borderLeftColor: c.border }]}>
          {f.narrative ? (
            <T variant="callout" selectable>
              &ldquo;{f.narrative.trim()}&rdquo;
            </T>
          ) : (
            <T variant="callout" tone="secondary">
              The state did not publish a narrative for this finding.
            </T>
          )}
          {standard ? (
            <T variant="footnote" tone="secondary" selectable>
              Rule {standard.number ? `${standard.number}: ` : ''}
              {standard.title}
            </T>
          ) : null}
          {f.via_investigation ? (
            <T variant="footnote" tone="secondary">
              Found during an investigation of a report, not a routine inspection.
            </T>
          ) : null}
          {f.technical_assistance ? (
            <T variant="footnote" tone="secondary">
              The inspector gave the daycare technical assistance on this rule.
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  body: { gap: space.xs + 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  toggle: {
    minHeight: minTap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    alignSelf: 'flex-start',
  },
  quote: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    padding: space.md,
    gap: space.sm,
  },
});
