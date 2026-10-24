import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDate, operationTypeLabel, plural, tidyCase } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { minTap, space, useColors } from '@/theme';

import { Icon } from './Icon';
import { T } from './T';

/** Name, type, place, then the last visit and a findings count. Never a grade. */
export function DaycareListRow({ d }: { d: DaycareRow }) {
  const c = useColors();
  const name = tidyCase(d.name);
  const place = [operationTypeLabel(d.operation_type), tidyCase(d.city)].filter(Boolean).join(' · ');
  const record = [
    d.last_inspection_date ? `Last state visit ${formatDate(d.last_inspection_date)}` : 'No state visits posted',
    `${plural(d.findings_24mo, 'finding')} in 24 months`,
  ].join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${place}. ${record}`}
      accessibilityHint="Opens the state record"
      onPress={() => router.push(`/daycare/${d.operation_id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.sunken }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="headline" numberOfLines={2}>
          {name}
        </T>
        <T variant="footnote" tone="secondary" numberOfLines={1}>
          {place}
          {d.distance_km != null ? ` · ${(d.distance_km * 0.621371).toFixed(1)} mi` : ''}
        </T>
        <T variant="footnote" tone="secondary" tabular>
          {record}
        </T>
      </View>
      <Icon name="chevronRight" size={14} color={c.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTap + 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
});
