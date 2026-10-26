import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadError } from '@/components/LoadError';
import { useDaycareSearch } from '@/lib/api';
import { formatDateShort, plural, tidyCase } from '@/lib/format';
import type { NearRow } from '@/lib/types';
import { space, useColors } from '@/theme';

import { Chip, ChipRow } from './Chip';
import { SearchPill } from './Chrome';
import { PlaceRow } from './DaycareCard';
import { type RowVisit, stripFromRow } from './RecordStrip';
import { RowSkeleton } from './Skeletons';
import { Text } from './Text';

/**
 * Web build (the judges' link): search first, then the nearby list. The search box types in place and its results
 * replace the list, so no keystroke is lost to a page change. No live map, no bottom sheet:
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

export function rowMeta(r: NearRow, today = new Date().toISOString().slice(0, 10)): string {
  const parts = [SHORT_TYPE[r.operation_type] ?? r.operation_type];
  if (typeof r.distance_km === 'number') parts.push(`${(r.distance_km * 0.621371).toFixed(1)} mi`);
  else if (r.city) parts.push(tidyCase(r.city));
  if (r.last_inspection_date) parts.push(`Visited ${formatDateShort(r.last_inspection_date, today)}`);
  return parts.join(' · ');
}

export function rowFallback(r: NearRow): string {
  const n = r.findings_24mo ?? 0;
  return n === 0 ? 'No findings posted in 24 months' : `${plural(n, 'finding')} in 24 months`;
}

export function rowStrip(r: NearRow) {
  const v: RowVisit[] | undefined = r.visits_24mo;
  return v && v.length > 0 ? stripFromRow(v) : null;
}

function matches(r: NearRow, f: Set<Filter>): boolean {
  if (f.has('centers') && !f.has('homes') && r.operation_type !== 'Licensed Center') return false;
  if (f.has('homes') && !f.has('centers') && r.operation_type === 'Licensed Center') return false;
  if (f.has('district') && !(r.in_district && r.district_basis === 'point')) return false;
  return true;
}

const NEAR_LIMIT = 50;
const WEB_TABS_CLEARANCE = 72;

type Props = {
  rows: NearRow[];
  loading: boolean;
  center: { lat: number; lng: number } | null;
  fallbackCenter: { lat: number; lng: number };
  areaName?: string;
  areaLabel?: string;
  watchedIds: Set<number>;
  onOpen: (operationId: number) => void;
  onToggleWatch?: (row: NearRow) => void;
  onSearch: () => void;
  onAlerts: () => void;
  onLocate: () => void;
  footer?: React.ReactNode;
};

export function HomeMap({ rows, loading, center, areaName, areaLabel, watchedIds, onOpen, footer }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const shown = useMemo(() => rows.filter((r) => matches(r, filters)), [rows, filters]);
  const [q, setQ] = useState('');
  const search = useDaycareSearch(q);
  const typed = q.trim().length >= 2;

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
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: insets.top + WEB_TABS_CLEARANCE,
          paddingBottom: space.xxl,
        },
      ]}
    >
      <View style={styles.pad}>
        <Text variant="largeTitle" accessibilityRole="header">
          Search any Texas daycare
        </Text>
        <Text variant="callout" tone="secondary" style={{ marginTop: space.xs, marginBottom: space.lg }}>
          See what Texas inspectors found at any daycare. Checked against the state every day.
        </Text>
        <SearchPill floating={false} input={{ value: q, onChangeText: setQ }} />
      </View>

      {typed ? (
        <View style={{ paddingTop: space.lg }}>
          {search.isError ? (
            <LoadError onRetry={() => void search.refetch()} />
          ) : !search.data ? (
            <View>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : search.data.length === 0 ? (
            <Text variant="callout" tone="secondary" style={{ padding: space.lg }}>
              No Texas daycares match “{q.trim()}”. Check the spelling, or try the city or ZIP.
            </Text>
          ) : (
            search.data.map((item, i) => (
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
        </View>
      ) : (
        <>
          <View style={{ height: space.xxl }} />
          <View style={styles.pad}>
            {/* One heading for the list: how many and around where, then the location state and the order. */}
            <Text variant="title" accessibilityRole="header">
              {loading && rows.length === 0
                ? 'Finding daycares…'
                : `${rows.length >= NEAR_LIMIT && filters.size === 0 ? `Closest ${rows.length}` : plural(shown.length, 'daycare')} near ${center ? 'you' : (areaName ?? 'you')}`}
            </Text>
            <Text variant="callout" tone="secondary">
              {!center && areaLabel ? `${areaLabel} · nearest first` : 'Nearest first'}
            </Text>
          </View>
          <ChipRow style={{ paddingVertical: space.lg }}>
            <Chip label="Centers" icon="center" selected={filters.has('centers')} onPress={() => toggle('centers')} />
            <Chip label="Homes" icon="home" selected={filters.has('homes')} onPress={() => toggle('homes')} />
            <Chip
              label="In TX-04"
              icon="district"
              selected={filters.has('district')}
              onPress={() => toggle('district')}
            />
          </ChipRow>

          {loading && rows.length === 0 ? (
            <View>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : shown.length === 0 ? (
            <Text variant="callout" tone="secondary" style={{ padding: space.lg }}>
              {filters.size > 0
                ? 'No daycares match these filters here.'
                : 'No licensed daycares within 15 km of here.'}
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
        </>
      )}
      <View style={[styles.pad, { paddingTop: space.lg }]}>{footer}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Readable on a laptop: the web build is a phone-width column, centered.
  page: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  pad: { paddingHorizontal: space.lg },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.lg + 64 + space.md,
  },
});
