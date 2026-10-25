import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryRow } from '@/components/ui/CategoryIcon';
import { SectionHeader } from '@/components/ui/Chrome';
import { Block } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/Icon';
import { useDistrictPulse, useDistrictRecentVisits } from '@/lib/api';
import { pulseLine, visitMeta, visitName, visitStatus } from '@/lib/feed';
import { todayIso } from '@/lib/format';
import { elevation, radius, space, useColors } from '@/theme';

const ROWS = 3;

/**
 * "In TX-04 last week": the state's newest visits in the district, so the app shows something new each week.
 * District-wide and newest first, never "worst" or "most": three rows, each opening that daycare's record.
 */
export function LastWeek({ onOpen }: { onOpen: (operationId: number) => void }) {
  const c = useColors();
  const pulse = useDistrictPulse();
  const visits = useDistrictRecentVisits(ROWS);
  const today = todayIso();

  // Nothing to say (no sync yet, or the RPC failed): leave the section out rather than show an empty box.
  if (pulse.isError || visits.isError || (pulse.isSuccess && !pulse.data) || (visits.isSuccess && visits.data.length === 0)) return null;
  const loading = !pulse.data || !visits.data;

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="In TX-04 last week" detail={pulse.data ? pulseLine(pulse.data) : ' '} />
      <View style={[styles.card, elevation.card, { backgroundColor: c.surface }]}>
        {loading
          ? Array.from({ length: ROWS }, (_, i) => (
              <View key={i} style={[styles.row, i > 0 && styles.divider, i > 0 && { borderTopColor: c.hairline }]}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Block style={{ width: '60%', height: 16 }} />
                  <Block style={{ width: '40%', height: 12 }} />
                  <Block style={{ width: '50%', height: 12 }} />
                </View>
              </View>
            ))
          : visits.data!.map((v, i) => (
              <Pressable
                key={v.activity_id}
                onPress={() => onOpen(v.operation_id)}
                accessibilityRole="button"
                accessibilityLabel={`${visitName(v)}. ${visitMeta(v, today)}. ${visitStatus(v)}.`}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.divider,
                  i > 0 && { borderTopColor: c.hairline },
                  pressed && { backgroundColor: c.sunken },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline" numberOfLines={2}>
                    {visitName(v)}
                  </Text>
                  <Text variant="footnote" tone="secondary" tabular>
                    {visitMeta(v, today)}
                  </Text>
                  <View style={styles.status}>
                    {v.categories.length > 0 ? <CategoryRow categories={v.categories} size={20} max={3} /> : null}
                    <Text variant="footnote" tone={v.findings_posted_so_far > 0 ? 'primary' : 'secondary'}>
                      {visitStatus(v)}
                    </Text>
                  </View>
                </View>
                <Icon name="chevronRight" size={14} color={c.textTertiary} />
              </Pressable>
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
});
