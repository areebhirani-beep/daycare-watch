import { Camera, type CameraRef, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DaycareListRow } from '@/components/DaycareListRow';
import { Icon } from '@/components/Icon';
import { ListSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { LastChecked, Rule } from '@/components/ui';
import { useDaycareSearch, useDaycaresNear, useMyWatches } from '@/lib/api';
import { plural } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { font, minTap, radius, space, TAB_BAR_CLEARANCE, type as typeScale, useColors, useIsDark } from '@/theme';

// Default view when location is off: Rockwall, inside TX-04. Camera only, not data.
const DEFAULT_CENTER = { lat: 32.9312, lng: -96.4597 };
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

export default function FindScreen() {
  const c = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const camera = useRef<CameraRef>(null);
  const searching = query.trim().length >= 2;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setCenter(DEFAULT_CENTER);
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })().catch(() => setCenter(DEFAULT_CENTER));
  }, []);

  const near = useDaycaresNear(center, 15);
  const search = useDaycareSearch(query);
  const watches = useMyWatches();
  const watchedIds = useMemo(() => new Set(watches.data?.map((d) => d.operation_id)), [watches.data]);

  const shape = useMemo(() => toGeoJSON(near.data ?? [], watchedIds), [near.data, watchedIds]);
  const list = searching ? search.data : near.data;
  const loading = searching ? search.isPending : near.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={styles.top}>
        <T variant="largeTitle" accessibilityRole="header">
          Find a daycare
        </T>
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Icon name="search" size={16} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, city, or ZIP"
            placeholderTextColor={c.textTertiary}
            accessibilityLabel="Search daycares by name, city, or ZIP"
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.input, { color: c.text }]}
          />
        </View>
      </View>

      {!searching ? (
        <View style={[styles.mapWrap, { borderColor: c.hairline }]}>
          <Map
            style={StyleSheet.absoluteFill}
            mapStyle={isDark ? STYLE_DARK : STYLE_LIGHT}
            logo={false}
            attribution
            attributionPosition={{ bottom: 6, right: 6 }}
            accessibilityLabel={`Map of ${plural(near.data?.length ?? 0, 'daycare')} near you. The list below has the same daycares.`}
          >
            <Camera
              ref={camera}
              initialViewState={{ center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat], zoom: 10 }}
              {...(center ? { center: [center.lng, center.lat] as [number, number], zoom: 11.5, duration: 0 } : {})}
            />
            <GeoJSONSource id="daycares" data={shape}>
              <Layer
                id="pins"
                type="circle"
                paint={{
                  'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 13, 6],
                  'circle-color': ['case', ['get', 'watched'], c.mapPinWatched, c.mapPin],
                  'circle-stroke-color': c.surface,
                  'circle-stroke-width': 1.5,
                }}
              />
            </GeoJSONSource>
          </Map>
        </View>
      ) : null}

      <FlatList
        data={list ?? []}
        keyExtractor={(d) => String(d.operation_id)}
        renderItem={({ item }) => <DaycareListRow d={item} />}
        ItemSeparatorComponent={() => <Rule inset={space.xl} />}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <T variant="caption" tone="secondary" accessibilityRole="header">
              {searching
                ? `${plural(list?.length ?? 0, 'match', 'matches')}`.toUpperCase()
                : 'NEAREST FIRST'}
            </T>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <View style={styles.empty}>
              <T variant="callout" tone="secondary">
                {searching
                  ? 'No Texas daycares match that name, city, or ZIP.'
                  : 'No daycares with a mapped address within 15 km. Try searching by name or city.'}
              </T>
            </View>
          )
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: space.xl }}>
            <LastChecked />
          </View>
        }
      />
    </View>
  );
}

function toGeoJSON(rows: DaycareRow[], watched: Set<number>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        type: 'Feature',
        id: d.operation_id,
        geometry: { type: 'Point', coordinates: [d.lng as number, d.lat as number] },
        properties: { operation_id: d.operation_id, watched: watched.has(d.operation_id) },
      })),
  };
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, gap: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: minTap,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, ...typeScale.body, fontFamily: font.regular, paddingVertical: space.sm },
  mapWrap: {
    height: 240,
    marginHorizontal: space.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  listHeader: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xs },
  empty: { paddingHorizontal: space.xl, paddingVertical: space.lg },
});

