import BottomSheet, { BottomSheetFlatList, type BottomSheetFlatListMethods, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateShort, plural, tidyCase } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { haptic, sheet, space, spring, TAB_BAR_CLEARANCE, useColors, useIsDark } from '@/theme';

import { FloatButton } from './Button';
import { Chip, ChipRow } from './Chip';
import { IconButton, SearchPill, SectionHeader, SheetHandle } from './Chrome';
import { DaycareCard, PlaceRow } from './DaycareCard';
import { ClusterBubble, MapPin } from './MapPin';
import { type RowVisit, stripFromRow } from './RecordStrip';
import { CardSkeleton, RowSkeleton } from './Skeletons';
import { Text } from './Text';

/**
 * The map home (uber-3 / googlemaps-4 / uber-4 / doordash-3 in harness/state/refs):
 * full-bleed map, floating search pill, locate button riding the sheet, a sheet with three detents.
 * Peek: count + filter chips. Half: a carousel of cards. Full: the dense list.
 * Data and navigation come in as props; this file only lays them out.
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

/** The compact strip for a row, when the RPC carries `visits_24mo`. */
export function rowStrip(r: DaycareRow) {
  // Cloud returns the field only after its next migration, so treat it as optional until then.
  const v: RowVisit[] | undefined = r.visits_24mo;
  return v && v.length > 0 ? stripFromRow(v) : null;
}

function matches(r: DaycareRow, f: Set<Filter>): boolean {
  if (f.has('centers') && !f.has('homes') && r.operation_type !== 'Licensed Center') return false;
  if (f.has('homes') && !f.has('centers') && r.operation_type === 'Licensed Center') return false;
  if (f.has('district') && !(r.in_district && r.district_basis === 'point')) return false;
  return true;
}

type Cluster = { key: string; lat: number; lng: number; rows: DaycareRow[] };

/** Screen-grid clustering: cheap, stable, fine for the 200 rows daycares_near returns. */
function cluster(rows: DaycareRow[], region: Region): Cluster[] {
  const cell = region.latitudeDelta / 7;
  const groups = new Map<string, DaycareRow[]>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    const k = region.latitudeDelta < 0.03 ? String(r.operation_id) : `${Math.floor(r.lat / cell)}:${Math.floor(r.lng / cell)}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    rows: g,
    lat: g.reduce((s, r) => s + (r.lat ?? 0), 0) / g.length,
    lng: g.reduce((s, r) => s + (r.lng ?? 0), 0) / g.length,
  }));
}

// The near() RPC returns at most this many rows, so a full page means "the closest N", not "all".
const NEAR_LIMIT = 50;
// From the screen bottom to just above the floating tab bar.
const TAB_FLOOR = TAB_BAR_CLEARANCE - 20;

type Props = {
  rows: DaycareRow[];
  loading: boolean;
  center: { lat: number; lng: number } | null;
  fallbackCenter: { lat: number; lng: number };
  /** Subtitle when there is no device location, e.g. "Near Frisco". */
  areaLabel?: string;
  watchedIds: Set<number>;
  onOpen: (operationId: number) => void;
  onToggleWatch?: (row: DaycareRow) => void;
  onSearch: () => void;
  onAlerts: () => void;
  onLocate: () => void;
  /** "Last checked with the state …" (CONTRACT 3), rendered at the end of the list. */
  footer?: React.ReactNode;
};

export function HomeMap({
  rows,
  loading,
  center,
  fallbackCenter,
  areaLabel,
  watchedIds,
  onOpen,
  onToggleWatch,
  onSearch,
  onAlerts,
  onLocate,
  footer,
}: Props) {
  const c = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const map = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  // Detents spring like Apple Maps instead of easing on a timer.
  const sheetSpring = useBottomSheetSpringConfigs(spring.sheet);
  const carousel = useRef<FlatList<DaycareRow>>(null);
  const list = useRef<BottomSheetFlatListMethods>(null);
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const start = center ?? fallbackCenter;
  const [region, setRegion] = useState<Region>({ latitude: start.lat, longitude: start.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 });

  const shown = useMemo(() => rows.filter((r) => matches(r, filters)), [rows, filters]);
  const mapped = useMemo(() => shown.filter((r) => r.lat != null && r.lng != null), [shown]);
  const clusters = useMemo(() => cluster(mapped, region), [mapped, region]);
  const featured = useMemo(() => shown.slice(0, 12), [shown]);

  const snapPoints = useMemo(
    () => [sheet.peek + TAB_BAR_CLEARANCE - 24, sheet.half, height - insets.top - 64],
    [height, insets.top],
  );

  // The location can arrive after the first render; follow it once it does.
  useEffect(() => {
    if (!center) return;
    map.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }, 450);
  }, [center]);
  const sheetY = useSharedValue(height);
  const locateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value - 64 }],
    opacity: sheetY.value < height * 0.4 ? 0 : 1,
  }));

  const toggle = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const pick = (r: DaycareRow) => {
    haptic.select();
    setSelected(r.operation_id);
    const i = featured.findIndex((x) => x.operation_id === r.operation_id);
    sheetRef.current?.snapToIndex(1);
    if (i >= 0) carousel.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0 });
    if (r.lat != null && r.lng != null)
      map.current?.animateToRegion({ latitude: r.lat - region.latitudeDelta * 0.18, longitude: r.lng, latitudeDelta: region.latitudeDelta, longitudeDelta: region.longitudeDelta }, 350);
  };

  const zoomInto = (k: Cluster) => {
    haptic.select();
    map.current?.animateToRegion(
      { latitude: k.lat, longitude: k.lng, latitudeDelta: region.latitudeDelta / 3, longitudeDelta: region.longitudeDelta / 3 },
      350,
    );
  };

  const cardW = Math.min(300, width - 72);

  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
            {loading && rows.length === 0
              ? 'Finding daycares…'
              : rows.length >= NEAR_LIMIT
                ? filters.size > 0
                  ? `${shown.length} of the closest ${rows.length}`
                  : `Closest ${rows.length}`
                : `${shown.length} daycares`}
          </Text>
          <Text variant="callout" tone="secondary">
            {center ? 'Near you' : (areaLabel ?? 'Near you')}
          </Text>
        </View>
        <IconButton icon="search" label="Search daycares" onPress={onSearch} size={40} />
      </View>
      <ChipRow style={{ paddingBottom: space.lg }}>
        <Chip label="Centers" icon="center" selected={filters.has('centers')} onPress={() => toggle('centers')} />
        <Chip label="Homes" icon="home" selected={filters.has('homes')} onPress={() => toggle('homes')} />
        <Chip label="In TX-04" icon="district" selected={filters.has('district')} onPress={() => toggle('district')} />
      </ChipRow>
      <SectionHeader title="Closest to you" onMore={() => sheetRef.current?.snapToIndex(2)} />
      {loading && rows.length === 0 ? (
        <View style={styles.carouselLoading}>
          <CardSkeleton width={cardW} />
          <CardSkeleton width={cardW} />
        </View>
      ) : (
        <FlatList
          ref={carousel}
          horizontal
          data={featured}
          keyExtractor={(r) => String(r.operation_id)}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + 12}
          decelerationRate="fast"
          contentContainerStyle={styles.carousel}
          onScrollToIndexFailed={() => undefined}
          renderItem={({ item }) => (
            <DaycareCard
              width={cardW}
              name={tidyCase(item.name)}
              meta={rowMeta(item)}
              lat={item.lat}
              lng={item.lng}
              operationType={item.operation_type}
              watched={watchedIds.has(item.operation_id)}
              strip={rowStrip(item)}
              fallback={rowFallback(item)}
              onPress={() => onOpen(item.operation_id)}
              onToggleWatch={onToggleWatch ? () => onToggleWatch(item) : undefined}
            />
          )}
        />
      )}
      <View style={{ height: space.xxl }} />
      <SectionHeader title="All nearby" detail={loading && rows.length === 0 ? undefined : 'Nearest first'} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        // Apple's muted base (light grey / graphite): the map recedes so the pins and the yellow carry.
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        mapPadding={{ top: insets.top + 64, bottom: 0, left: 0, right: 0 }}
        onPress={() => setSelected(null)}
      >
        {clusters.map((k) =>
          k.rows.length === 1 ? (
            <Marker
              key={k.key}
              coordinate={{ latitude: k.lat, longitude: k.lng }}
              onPress={() => pick(k.rows[0]!)}
              tracksViewChanges={false}
              accessibilityLabel={tidyCase(k.rows[0]!.name)}
              zIndex={selected === k.rows[0]!.operation_id ? 10 : 1}
            >
              <MapPin watched={watchedIds.has(k.rows[0]!.operation_id)} selected={selected === k.rows[0]!.operation_id} />
            </Marker>
          ) : (
            <Marker key={k.key} coordinate={{ latitude: k.lat, longitude: k.lng }} onPress={() => zoomInto(k)} tracksViewChanges={false}>
              <ClusterBubble count={k.rows.length} />
            </Marker>
          ),
        )}
      </MapView>

      <View style={[styles.top, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <SearchPill
          onPress={onSearch}
          trailing={<IconButton icon="bell" label="Watching and alerts" onPress={onAlerts} size={38} />}
        />
      </View>

      <Animated.View style={[styles.locate, locateStyle]} pointerEvents="box-none">
        <FloatButton icon="locate" label="Show daycares near me" onPress={onLocate} />
      </Animated.View>

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        animatedPosition={sheetY}
        handleComponent={SheetHandle}
        backgroundStyle={{ backgroundColor: c.surface, borderRadius: 28 }}
        style={sheetShadow}
        animationConfigs={sheetSpring}
        enableDynamicSizing={false}
        onChange={(i) => {
          if (i === 2) haptic.heavy();
          else haptic.select();
        }}
      >
        <BottomSheetFlatList
          ref={list}
          data={loading && rows.length === 0 ? [] : shown}
          keyExtractor={(r: DaycareRow) => String(r.operation_id)}
          ListHeaderComponent={header}
          ListEmptyComponent={
            loading ? (
              <View>
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </View>
            ) : (
              <Text variant="callout" tone="secondary" style={{ padding: space.lg }}>
                {filters.size > 0 ? 'No daycares match these filters here.' : 'No licensed daycares within 15 km of here.'}
              </Text>
            )
          }
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.hairline }]} />}
          renderItem={({ item }: { item: DaycareRow }) => (
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
              onToggleWatch={onToggleWatch ? () => onToggleWatch(item) : undefined}
            />
          )}
          ListFooterComponent={<View style={{ paddingHorizontal: space.lg, paddingBottom: TAB_BAR_CLEARANCE }}>{footer}</View>}
        />
      </BottomSheet>
      {/* A solid floor under the floating tab bar: list content slides behind it, never under the glass. */}
      <View pointerEvents="none" style={[styles.floor, { height: TAB_FLOOR, backgroundColor: c.surface, borderTopColor: c.hairline }]} />
    </View>
  );
}

const sheetShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.1,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: -4 },
  elevation: 12,
} as const;

const styles = StyleSheet.create({
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  top: { position: 'absolute', left: space.lg, right: space.lg },
  locate: { position: 'absolute', right: space.lg, top: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
  carousel: { paddingHorizontal: space.lg, gap: 12 },
  carouselLoading: { flexDirection: 'row', gap: 12, paddingHorizontal: space.lg },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + 64 + space.md },
});
