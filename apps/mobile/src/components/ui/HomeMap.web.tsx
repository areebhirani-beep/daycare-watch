import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateShort, plural, tidyCase } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { space, useColors } from '@/theme';

import { Chip, ChipRow } from './Chip';
import { SearchPill, SectionHeader } from './Chrome';
import { PlaceRow } from './DaycareCard';
import { type RowVisit, stripFromRow } from './RecordStrip';
import { RowSkeleton } from './Skeletons';
import { Text } from './Text';

/**
 * Web build (the judges' link): search first, then the nearby list. No live map, no bottom sheet:
 * react-native-maps and @gorhom/bottom-sheet have no web support. Same exports and props as HomeMap.tsx;
 * keep rowMeta / rowFallback / rowStrip in step with it.
 */

export type Filter = 'centers' | 'homes' | 'district';

const SHORT_TYPE: Record<string, string> = {
  'Licensed Center': 'Center',
  'Licensed Child-Care Home': 'Licensed home',
  'Listed Family Home': 'Listed home',
  'Registered Child-Care Home': 'Registered home',
};

export function rowMeta(r: DaycareRow, today = new Date().toISOString().slice(0, 10)): string {
  const parts = [SHORT_TYPE[r.operation_type] ?? r.operation_type];
  if (typeof r.distance_km === 'number') parts.push(`${(r.distance_km * 0.621371).toFixed(1)} mi`);
  else if (r.city) parts.push(tidyCase(r.city));
  if (r.last_inspection_date) parts.push(`Visited ${formatDateShort(r.last_inspection_date, today)}`);
  return parts.join(' · ');
}

export function rowFallback(r: DaycareRow): string {
  const n = r.findings_24mo ?? 0;
  return n === 0 ? 'No findings posted in 24 months' : `${plural(n, 'finding')} in 24 months`;
}

export function rowStrip(r: DaycareRow) {
  const v: RowVisit[] | undefined = r.visits_24mo;
  return v && v.length > 0 ? stripFromRow(v) : null;
}

function matches(r: DaycareRow, f: Set<Filter>): boolean {
  if (f.has('centers') && !f.has('homes') && r.operation_type !== 'Licensed Center') return false;
  if (f.has('homes') && !f.has('centers') && r.operation_type === 'Licensed Center') return false;
  if (f.has('district') && !(r.in_district && r.district_basis === 'point')) return false;
  return true;
}

const NEAR_LIMIT = 50;
const WEB_TABS_CLEARANCE = 72;

type Props = {
  rows: DaycareRow[];
  loading: boolean;
  center: { lat: number; lng: number } | null;
  fallbackCenter: { lat: number; lng: number };
  areaLabel?: string;
  watchedIds: Set<number>;
  onOpen: (operationId: number) => void;
  onToggleWatch?: (row: DaycareRow) => void;
  onSearch: () => void;
  onAlerts: () => void;
  onLocate: () => void;
  footer?: React.ReactNode;
};

export function HomeMap({ rows, loading, center, areaLabel, watchedIds, onOpen, onSearch, footer }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const shown = useMemo(() => rows.filter((r) => matches(r, filters)), [rows, filters]);

  const toggle = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      // On web the tab bar floats at the top of the page, so the content starts below it.
      contentContainerStyle={[styles.page, { paddingTop: insets.top + WEB_TABS_CLEARANCE, paddingBottom: space.xxl }]}
    >
      <View style={styles.pad}>
        <Text variant="largeTitle" accessibilityRole="header">
          Search any Texas daycare
        </Text>
        <Text variant="callout" tone="secondary" style={{ marginTop: space.xs, marginBottom: space.lg }}>
          What state inspectors found, in plain English. Checked against the state every day.
        </Text>
        <SearchPill onPress={onSearch} floating={false} />
      </View>

      <View style={{ height: space.xxl }} />
      <View style={styles.pad}>
        <Text variant="title" accessibilityRole="header">
          {loading && rows.length === 0
            ? 'Finding daycares…'
            : rows.length >= NEAR_LIMIT
              ? `Closest ${rows.length}`
              : `${shown.length} daycares`}
        </Text>
        <Text variant="callout" tone="secondary">
          {center ? 'Near you' : (areaLabel ?? 'Near you')}
        </Text>
      </View>
      <ChipRow style={{ paddingVertical: space.lg }}>
        <Chip label="Centers" icon="center" selected={filters.has('centers')} onPress={() => toggle('centers')} />
        <Chip label="Homes" icon="home" selected={filters.has('homes')} onPress={() => toggle('homes')} />
        <Chip label="In TX-04" icon="district" selected={filters.has('district')} onPress={() => toggle('district')} />
      </ChipRow>
      <SectionHeader title="Nearby" detail={loading && rows.length === 0 ? undefined : 'Nearest first'} />

      {loading && rows.length === 0 ? (
        <View>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </View>
      ) : shown.length === 0 ? (
        <Text variant="callout" tone="secondary" style={{ padding: space.lg }}>
          {filters.size > 0 ? 'No daycares match these filters here.' : 'No licensed daycares within 15 km of here.'}
        </Text>
      ) : (
        shown.map((item, i) => (
          <View key={item.operation_id}>
            {i > 0 ? <View style={[styles.sep, { backgroundColor: c.hairline }]} /> : null}
            <PlaceRow
              name={tidyCase(item.name)}
              meta={rowMeta(item)}
              lat={item.lat}
              lng={item.lng}
              operationType={item.operation_type}
              watched={watchedIds.has(item.operation_id)}
              strip={rowStrip(item)}
              fallback={rowFallback(item)}
              onPress={() => onOpen(item.operation_id)}
            />
          </View>
        ))
      )}
      <View style={[styles.pad, { paddingTop: space.lg }]}>{footer}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Readable on a laptop: the web build is a phone-width column, centered.
  page: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  pad: { paddingHorizontal: space.lg },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + 64 + space.md },
});
