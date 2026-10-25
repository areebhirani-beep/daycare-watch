import BottomSheet, { BottomSheetFlatList, type BottomSheetFlatListMethods, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateShort, plural, tidyCase } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { fade, haptic, sheet, space, spring, TAB_BAR_CLEARANCE, useColors, useIsDark } from '@/theme';

import { FloatButton } from './Button';
import { Chip, ChipRow } from './Chip';
import { SearchPill, SectionHeader, SheetHandle } from './Chrome';
import { DaycareCard, PlaceRow } from './DaycareCard';
import { imageryAllowed } from '@/lib/imagery';
import { regionFor } from '@/lib/region';

import { AreaPin, ClusterBubble, MapPin, pinKind } from './MapPin';
import { type RowVisit, stripFromRow } from './RecordStrip';
import { CardSkeleton, RowSkeleton } from './Skeletons';
import { Text } from './Text';

/**
 * The map home (Uber and Google Maps structure):
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
  // With a per-visit summary the card's own line carries the date ("3 problems found Oct 5").
  if (r.last_inspection_date && !r.visits_24mo?.length) parts.push(`Visited ${formatDateShort(r.last_inspection_date, today)}`);
  return parts.join(' · ');
}

export function rowFallback(r: DaycareRow, today = new Date().toISOString().slice(0, 10)): string {
  const n = r.findings_24mo ?? 0;
  if (n > 0) return `${plural(n, 'problem')} posted in 2 years`;
  // "No problems" only when the state visited; with no visit there is nothing to report either way.
  const cutoff = `${Number(today.slice(0, 4)) - 2}${today.slice(4)}`;
  const visited = (r.visits_24mo?.length ?? 0) > 0 || (r.last_inspection_date != null && r.last_inspection_date >= cutoff);
  return visited ? 'No problems posted in 2 years' : 'No state visits posted in 2 years';
}

/** The compact strip for a row, when the RPC carries `visits_24mo`. */
export function rowStrip(r: DaycareRow) {
  // Cloud returns the field only after its next migration, so treat it as optional until then.
  const v: RowVisit[] | undefined = r.visits_24mo;
  // An empty list is a real answer (no visits in 24 months), so only a missing field falls back.
  return v ? stripFromRow(v) : null;
}

function matches(r: DaycareRow, f: Set<Filter>): boolean {
  if (f.has('centers') && !f.has('homes') && r.operation_type !== 'Licensed Center') return false;
  if (f.has('homes') && !f.has('centers') && r.operation_type === 'Licensed Center') return false;
  if (f.has('district') && !(r.in_district && r.district_basis === 'point')) return false;
  return true;
}

type Cluster = { key: string; lat: number; lng: number; rows: DaycareRow[] };

// Pins closer than this on screen would overlap, so they share one bubble.
const CLUSTER_PT = 52;

/** Screen-grid clustering in points: cheap, stable, fine for the rows daycares_near returns. */
// Under this span (degrees, about 20 m) a cluster's daycares share one point and can't be split by zooming.
const STACKED = 0.0002;
const stacked = (k: Cluster) => {
  const lats = k.rows.map((r) => r.lat!);
  const lngs = k.rows.map((r) => r.lng!);
  return Math.max(...lats) - Math.min(...lats) < STACKED && Math.max(...lngs) - Math.min(...lngs) < STACKED;
};

/** Map layering: translucent home/approximate areas under solid pins, watched above, clusters above, the picked one on top. */
function markerZ(r: DaycareRow, selected: boolean, watched: boolean): number {
  if (selected) return 10;
  if (watched) return 2;
  return imageryAllowed(r.operation_type) && r.geocode_quality !== 'non_exact' ? 1 : 0;
}

function cluster(rows: DaycareRow[], region: Region, width: number, height: number): Cluster[] {
  const latCell = (region.latitudeDelta * CLUSTER_PT) / height;
  const lngCell = (region.longitudeDelta * CLUSTER_PT) / width;
  const groups = new Map<string, DaycareRow[]>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    const k = `${Math.floor(r.lat / latCell)}:${Math.floor(r.lng / lngCell)}`;
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

// From the screen bottom to just above the floating tab bar.
const TAB_FLOOR = TAB_BAR_CLEARANCE - 20;

type Props = {
  rows: DaycareRow[];
  loading: boolean;
  center: { lat: number; lng: number } | null;
  fallbackCenter: { lat: number; lng: number };
  /** Subtitle when there is no device location, e.g. "Near Frisco". */
  /** The town in the title when the list isn't around the parent's own location: 'Daycares near Frisco'. */
  areaName?: string;
  areaLabel?: string;
  watchedIds: Set<number>;
  onOpen: (operationId: number) => void;
  onToggleWatch?: (row: DaycareRow) => void;
  onSearch: () => void;
  onLocate: () => void;
  /** "Last checked with the state …" (every data screen says when it last matched the state), rendered at the end of the list. */
  footer?: React.ReactNode;
  /** A section between the closest cards and the full list (the "last week in TX-04" feed). */
  feed?: React.ReactNode;
  /** Pull-to-refresh on the sheet's list. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function HomeMap({
  rows,
  loading,
  center,
  fallbackCenter,
  areaName,
  areaLabel,
  watchedIds,
  onOpen,
  onToggleWatch,
  onSearch,
  onLocate,
  footer,
  feed,
  refreshing = false,
  onRefresh,
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
  // Daycares that share one map point (homes are placed by a rounded point, so a street's homes stack): a tap on
  // their bubble lists them in the sheet, because no zoom can split them.
  const [group, setGroup] = useState<ReadonlySet<number> | null>(null);
  const start = center ?? fallbackCenter;
  const [region, setRegion] = useState<Region>({ latitude: start.lat, longitude: start.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 });

  const shown = useMemo(() => rows.filter((r) => matches(r, filters)), [rows, filters]);
  const mapped = useMemo(() => shown.filter((r) => r.lat != null && r.lng != null), [shown]);
  // Pins under the status bar and the search pill can't be read or tapped; leave them off until the map pans.
  const pillBottom = insets.top + 64;
  const clusters = useMemo(() => {
    const topLat = region.latitude + region.latitudeDelta / 2 - (pillBottom / height) * region.latitudeDelta;
    return cluster(mapped, region, width, height).filter((k) => k.lat < topLat);
  }, [mapped, region, width, height, pillBottom]);
  const listed = useMemo(() => (group ? shown.filter((r) => group.has(r.operation_id)) : shown), [shown, group]);
  const featured = useMemo(() => listed.slice(0, 12), [listed]);
  const cardW = Math.min(300, width - 72);

  const snapPoints = useMemo(
    () => [sheet.peek + TAB_BAR_CLEARANCE - 24, sheet.half, height - insets.top - 64],
    [height, insets.top],
  );

  // The half sheet covers the bottom 64% of the screen, so the map's working area is the strip above it.
  const sheetCover = Math.round(height * 0.64);
  // Apple's Legal link rides just above whichever detent the sheet rests at, clear of the pins it would cover.
  const [detent, setDetent] = useState(1);
  const legalBottom = (detent === 0 ? sheet.peek + TAB_BAR_CLEARANCE - 24 : sheetCover) + space.sm;
  // The location can arrive after the first render; follow it once it does. If it drops out (outside Texas),
  // fly back to the fallback area so the map matches the list.
  const targetLat = start.lat;
  const targetLng = start.lng;
  // The strip between the search pill and the half sheet is where the map can really be seen.
  const view = useMemo(
    () => ({ width, height, top: pillBottom, bottom: height - sheetCover }),
    [width, height, pillBottom, sheetCover],
  );
  // A camera move sent before the map has a size lands zoomed out to half of Texas, so nothing moves until the
  // map is ready. Then show the parent's point and the nearest pins in that strip (just the point while loading).
  const [ready, setReady] = useState(false);
  const fitKey = `${targetLat},${targetLng}:${mapped.slice(0, 8).map((r) => r.operation_id).join(',')}`;
  useEffect(() => {
    if (!ready) return;
    const near = mapped.slice(0, 8).map((r) => ({ latitude: r.lat!, longitude: r.lng! }));
    const points = center || near.length === 0 ? [{ latitude: targetLat, longitude: targetLng }, ...near] : near;
    const next = regionFor(points, view);
    if (next) map.current?.animateToRegion(next, 450);
  }, [ready, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
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
    // A lone pin is never inside a stacked spot, so picking one shows the full list again.
    setGroup(null);
    sheetRef.current?.snapToIndex(1);
    if (r.lat != null && r.lng != null)
      map.current?.animateToRegion(
        { ...region, latitude: r.lat - ((height / 2 - (view.top + view.bottom) / 2) / height) * region.latitudeDelta, longitude: r.lng },
        350,
      );
  };

  // After the render that picked it, so the carousel already holds the full list when it scrolls. On the snap grid,
  // so the picked card keeps the 16 pt gutter (scrollToIndex would put it flush to the edge).
  useEffect(() => {
    const i = featured.findIndex((x) => x.operation_id === selected);
    if (i >= 0) carousel.current?.scrollToOffset({ offset: i * (cardW + 12), animated: true });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps
  // A stacked spot's list starts at its first card, wherever the carousel was.
  useEffect(() => {
    if (group) carousel.current?.scrollToOffset({ offset: 0, animated: false });
  }, [group]);

  const zoomInto = (k: Cluster) => {
    haptic.select();
    if (stacked(k)) {
      setSelected(null);
      setGroup(new Set(k.rows.map((r) => r.operation_id)));
      sheetRef.current?.snapToIndex(1);
      list.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    // Fit the cluster's daycares into the strip above the sheet (centering on the screen put them under it),
    // zooming in at least 3x so the bubble splits.
    const next = regionFor(
      k.rows.map((r) => ({ latitude: r.lat!, longitude: r.lng! })),
      view,
      region.latitudeDelta / 3,
    );
    if (next) map.current?.animateToRegion(next, 350);
  };


  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
            {loading && rows.length === 0 ? 'Finding daycares…' : `Daycares near ${areaName ?? 'you'}`}
          </Text>
          {group ? (
            <View style={styles.groupRow}>
              <Text variant="callout" tone="secondary">
                {`${listed.length} daycares at this spot`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show all daycares near you"
                onPress={() => setGroup(null)}
                style={styles.showAll}
              >
                <Text variant="callout" tone="accent">
                  Show all
                </Text>
              </Pressable>
            </View>
          ) : areaLabel || filters.size > 0 ? (
            <Text variant="callout" tone="secondary">
              {areaLabel ?? `${shown.length} of ${rows.length} match`}
            </Text>
          ) : null}
        </View>
      </View>
      <ChipRow style={{ paddingBottom: space.lg }}>
        <Chip label="Centers" icon="center" selected={filters.has('centers')} onPress={() => toggle('centers')} />
        <Chip label="Homes" icon="home" selected={filters.has('homes')} onPress={() => toggle('homes')} />
        <Chip label="In TX-04" icon="district" selected={filters.has('district')} onPress={() => toggle('district')} />
      </ChipRow>
      <SectionHeader title={group ? 'At this spot' : areaLabel ? 'Closest first' : 'Closest to you'} onMore={() => sheetRef.current?.snapToIndex(2)} moreLabel="Show the full list" />
      {loading && rows.length === 0 ? (
        <View style={styles.carouselLoading}>
          <CardSkeleton width={cardW} />
          <CardSkeleton width={cardW} />
        </View>
      ) : (
        // Skeleton to cards: one 200 ms cross-fade when the cards first mount; a refresh keeps them mounted, so no replay.
        <Animated.View entering={fade()}>
          <FlatList
            ref={carousel}
            horizontal
            data={featured}
            keyExtractor={(r) => String(r.operation_id)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + 12}
            decelerationRate="fast"
            contentContainerStyle={styles.carousel}
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
        </Animated.View>
      )}
      {feed ? <View style={{ paddingTop: space.xxl }}>{feed}</View> : null}
      <View style={{ height: space.xxl }} />
      <SectionHeader title="All nearby" detail={loading && rows.length === 0 ? undefined : 'Nearest first'} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* react-native-maps can't name a custom pin for VoiceOver (each reads "Map pin"), so the map is one
          element that points to the list, which holds the same daycares with their records. */}
      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityLabel="Map of daycares. The same daycares are listed below, with their records."
      >
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
          onMapReady={() => setReady(true)}
          showsUserLocation
          // The parent's own dot is the system blue everyone knows from Maps, never the ink of a cluster bubble.
          tintColor={isDark ? '#0A84FF' : '#007AFF'}
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          // Apple's standard map, as in Apple Maps: color, parks and water make the area recognizable.
          mapType="standard"
          showsBuildings
          // Apple's Legal link stays visible above the half sheet.
          legalLabelInsets={{ top: 0, left: space.lg, bottom: legalBottom, right: 0 }}
          // A marker's press bubbles up here too (action 'marker-press'); only a tap on the open map clears the pick.
          onPress={(e) => {
            if (e.nativeEvent.action === 'marker-press') return;
            setSelected(null);
            setGroup(null);
          }}
        >
          {clusters.map((k) =>
            k.rows.length === 1 ? (
              <Marker
                key={k.key}
                coordinate={{ latitude: k.lat, longitude: k.lng }}
                onPress={() => pick(k.rows[0]!)}
                tracksViewChanges={false}
                zIndex={markerZ(k.rows[0]!, selected === k.rows[0]!.operation_id, watchedIds.has(k.rows[0]!.operation_id))}
              >
                {/* iOS ignores a Marker's own label when it draws a custom view, so the view carries it. */}
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${tidyCase(k.rows[0]!.name)}, ${SHORT_TYPE[k.rows[0]!.operation_type] ?? k.rows[0]!.operation_type}`}
                >
                  {/* A solid pin only for a center with an exact point; homes (privacy) and approximate points get an area. */}
                  {imageryAllowed(k.rows[0]!.operation_type) && k.rows[0]!.geocode_quality !== 'non_exact' ? (
                    <MapPin
                      kind={pinKind(k.rows[0]!.operation_type)}
                      watched={watchedIds.has(k.rows[0]!.operation_id)}
                      selected={selected === k.rows[0]!.operation_id}
                      label={selected === k.rows[0]!.operation_id ? tidyCase(k.rows[0]!.name) : undefined}
                    />
                  ) : (
                    <AreaPin
                      kind={pinKind(k.rows[0]!.operation_type)}
                      watched={watchedIds.has(k.rows[0]!.operation_id)}
                      selected={selected === k.rows[0]!.operation_id}
                    />
                  )}
                </View>
              </Marker>
            ) : (
              <Marker
                key={k.key}
                coordinate={{ latitude: k.lat, longitude: k.lng }}
                onPress={() => zoomInto(k)}
                tracksViewChanges={false}
                zIndex={group && k.rows.some((r) => group.has(r.operation_id)) ? 10 : 3}
              >
                <View accessible accessibilityRole="button" accessibilityLabel={`${k.rows.length} daycares here. ${stacked(k) ? 'Lists them below.' : 'Zooms in.'}`}>
                  <ClusterBubble count={k.rows.length} selected={group !== null && k.rows.some((r) => group.has(r.operation_id))} />
                </View>
              </Marker>
            ),
          )}
        </MapView>
      </View>

      <View style={[styles.top, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <SearchPill onPress={onSearch} />
      </View>

      <Animated.View style={[styles.locate, locateStyle]} pointerEvents="box-none">
        <FloatButton icon="locate" label="Show daycares near me" onPress={onLocate} />
      </Animated.View>

      <BottomSheet
        // The library makes the whole sheet one 'Bottom Sheet' element, which hides every row from VoiceOver.
        accessible={false}
        ref={sheetRef}
        index={1}
        onAnimate={(_from, to) => setDetent(to)}
        snapPoints={snapPoints}
        animatedPosition={sheetY}
        handleComponent={SheetHandle}
        backgroundStyle={{ backgroundColor: c.surface, borderRadius: 28 }}
        style={sheetShadow}
        animationConfigs={sheetSpring}
        enableDynamicSizing={false}
      >
        <BottomSheetFlatList
          ref={list}
          data={loading && rows.length === 0 ? [] : listed}
          keyExtractor={(r: DaycareRow) => String(r.operation_id)}
          ListHeaderComponent={header}
          refreshing={refreshing}
          onRefresh={onRefresh}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.md,
  },
  carousel: { paddingHorizontal: space.lg, gap: 12 },
  carouselLoading: { flexDirection: 'row', gap: 12, paddingHorizontal: space.lg },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  showAll: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + 64 + space.md },
});
