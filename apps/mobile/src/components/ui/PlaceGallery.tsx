import { useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { radius, space, useColors, useIsDark } from '@/theme';

import { MapPin } from './MapPin';
import { MapSnapshot } from './MapSnapshot';
import { Text } from './Text';

/** How the pin was placed (integrator, Oct 24). Even "exact" is street-range interpolation, never a rooftop. */
export type GeocodeQuality = 'state' | 'exact' | 'non_exact';

export function locationLabel(q: GeocodeQuality | null | undefined): string {
  switch (q) {
    case 'state':
      return 'Location from the state record';
    case 'exact':
      return 'Placed from the street address';
    case 'non_exact':
      return 'Approximate location (address matched with corrections)';
    default:
      return 'Area around the address';
  }
}

type Page = { key: 'near' | 'wide' | 'flyover' | 'map' | 'area'; caption: string };

/**
 * Home daycares (private residences) get a single neighborhood street map: no photo, no pin, no flyover.
 *
 * Swipeable place-page hero so a parent can tell it's the right place: the aerial at two zooms and
 * Apple's 3D flyover. It shows the area, never claims to show the building. When the address only
 * matched with corrections, the aerials are hidden and a plain map stands in.
 */
export function PlaceGallery({
  lat,
  lng,
  quality,
  imagery,
  watched,
  height,
  bottomInset = 0,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  quality?: GeocodeQuality | null;
  /** False for home daycares (lib/imagery): one neighborhood street map, no photo, no pin, no flyover. */
  imagery: boolean;
  watched?: boolean;
  height: number;
  /** Space taken by whatever overlaps the bottom of the hero (the head card). */
  bottomInset?: number;
}) {
  const c = useColors();
  const isDark = useIsDark();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const has = typeof lat === 'number' && typeof lng === 'number';
  const aerial = has && imagery && quality !== 'non_exact';

  const pages: Page[] = !imagery
    ? [{ key: 'area', caption: 'Neighborhood only · private home' }]
    : aerial
    ? [
        { key: 'near', caption: locationLabel(quality) },
        { key: 'wide', caption: 'The neighborhood' },
        ...(Platform.OS === 'ios' ? [{ key: 'flyover' as const, caption: '3D view, Apple Maps' }] : []),
      ]
    : [{ key: 'map', caption: locationLabel(quality) }];

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const region = has ? { latitude: lat, longitude: lng, latitudeDelta: 0.008, longitudeDelta: 0.008 } : undefined;

  // The state record has no map location: a plain band, no caption, nothing that pretends to be a map.
  if (!has) return <View style={{ height, backgroundColor: c.sunken }} />;

  return (
    <View style={{ height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} scrollEnabled={pages.length > 1}>
        {pages.map((p, i) => (
          <View key={p.key} style={{ width, height }}>
            {p.key === 'area' ? (
              <MapSnapshot lat={lat} lng={lng} zoom={14} privateHome attributionInset={bottomInset} style={{ height }} />
            ) : p.key === 'near' ? (
              <MapSnapshot lat={lat} lng={lng} zoom={17} watched={watched} attributionInset={bottomInset} style={{ height }} />
            ) : p.key === 'wide' ? (
              <MapSnapshot lat={lat} lng={lng} zoom={15} watched={watched} smallPin attributionInset={bottomInset} style={{ height }} />
            ) : region && (p.key === 'map' || i <= page + 1) ? (
              // Mounted only when it's next in line, so the 3D view loads on view, not on open.
              <MapView
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                initialRegion={region}
                initialCamera={
                  p.key === 'flyover'
                    ? { center: { latitude: lat!, longitude: lng! }, pitch: 60, heading: 30, altitude: 420, zoom: 17 }
                    : undefined
                }
                mapType={p.key === 'flyover' ? 'satelliteFlyover' : Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                showsPointsOfInterests={false}
                mapPadding={{ top: 0, left: 0, right: 0, bottom: bottomInset }}
              >
                <Marker coordinate={{ latitude: lat!, longitude: lng! }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                  <MapPin watched={watched} selected />
                </Marker>
              </MapView>
            ) : (
              <View style={{ flex: 1, backgroundColor: c.sunken }} />
            )}
          </View>
        ))}
      </ScrollView>

      <View pointerEvents="none" style={[styles.caption, { bottom: bottomInset + space.sm }]}>
        <Text variant="caption" style={styles.captionText} maxFontSizeMultiplier={1.2} numberOfLines={1}>
          {pages[page]?.caption}
        </Text>
      </View>
      {pages.length > 1 ? (
        <View pointerEvents="none" style={[styles.dots, { bottom: bottomInset + space.xxxl + space.xs }]}>
          {pages.map((p, i) => (
            <View key={p.key} style={[styles.dot, { opacity: i === page ? 1 : 0.45, width: i === page ? 16 : 6 }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    position: 'absolute',
    left: space.sm,
    maxWidth: '58%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  captionText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14 },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
});
