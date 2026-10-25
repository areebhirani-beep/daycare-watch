import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { LastChecked, Rule, SectionLabel } from '@/components/ui';
import { useDistrictPulse } from '@/lib/api';
import { categoryLabel, formatDate, formatDateShort, plural } from '@/lib/format';
import type { DistrictPulse } from '@/lib/types';
import { radius, space, TAB_BAR_CLEARANCE, useColors } from '@/theme';

export default function PulseScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pulse = useDistrictPulse();
  const p = pulse.data as (DistrictPulse & { findings_high?: number }) | undefined;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}
      refreshControl={<RefreshControl refreshing={pulse.isRefetching} onRefresh={() => void pulse.refetch()} />}
    >
      <View style={{ gap: space.sm }}>
        <T variant="largeTitle" accessibilityRole="header">
          This week
        </T>
        <T variant="callout" tone="secondary">
          {p
            ? `What Texas inspectors posted for daycares in the 4th Congressional District, ${formatDateShort(p.week_start, p.week_end)} – ${formatDate(p.week_end)}.`
            : 'What Texas inspectors posted for daycares in the 4th Congressional District.'}
        </T>
      </View>

      {!p ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <View style={styles.grid}>
            <Stat n={p.visits} label="state visits" />
            <Stat n={p.daycares_visited} label="daycares visited" />
            <Stat n={p.visits_with_findings} label="visits with findings" />
            <Stat n={p.findings} label="findings posted" />
          </View>
          {p.findings_high != null ? (
            <T variant="callout" tone="secondary">
              {plural(p.findings_high, 'finding')} on rules the state rates High risk.
            </T>
          ) : null}

          {p.by_category.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel>By category</SectionLabel>
              {p.by_category
                .slice()
                .sort((a, b) => b.n - a.n)
                .map((row, i, all) => {
                  const max = all[0]?.n ?? 1;
                  return (
                    <View key={row.category}>
                      {i > 0 ? <Rule /> : null}
                      <View
                        style={styles.catRow}
                        accessible
                        accessibilityLabel={`${categoryLabel(row.category)}: ${plural(row.n, 'finding')}`}
                      >
                        <View style={{ flex: 1, gap: space.xs }}>
                          <T variant="callout">{categoryLabel(row.category)}</T>
                          <View style={[styles.track, { backgroundColor: c.sunken }]}>
                            <View
                              style={[styles.bar, { backgroundColor: c.textSecondary, width: `${(row.n / max) * 100}%` }]}
                            />
                          </View>
                        </View>
                        <T variant="headline" tabular style={styles.catN}>
                          {row.n}
                        </T>
                      </View>
                    </View>
                  );
                })}
            </View>
          ) : null}

          <T variant="footnote" tone="tertiary" style={{ paddingTop: space.lg }}>
            The state posts findings after due process, often a week or more after a visit, so recent weeks fill in over
            time.
          </T>
        </>
      )}
      <LastChecked />
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const c = useColors();
  return (
    <View
      style={[styles.stat, { backgroundColor: c.surface, borderColor: c.hairline }]}
      accessible
      accessibilityLabel={`${n} ${label}`}
    >
      <T variant="largeTitle" tabular>
        {n.toLocaleString('en-US')}
      </T>
      <T variant="footnote" tone="secondary">
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: TAB_BAR_CLEARANCE, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.md },
  stat: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xxs,
  },
  section: { paddingTop: space.lg, gap: space.xs },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md },
  catN: { minWidth: 36, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
});
