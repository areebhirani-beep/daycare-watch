import { StyleSheet, View } from 'react-native';

import { space, useColors } from '@/theme';

import { MapSnapshot } from './MapSnapshot';
import { Text } from './Text';

/**
 * Web build (the judges' link): one static map image instead of the swipeable native hero.
 * react-native-maps has no web support, so nothing here imports it. Same exports as PlaceGallery.tsx.
 */

/** How the pin was placed. Even "exact" is street-range interpolation, never a rooftop. */
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
  imagery: boolean;
  watched?: boolean;
  height: number;
  bottomInset?: number;
}) {
  const c = useColors();
  const has = typeof lat === 'number' && typeof lng === 'number';

  // The state record has no map location: a plain band, no caption, nothing that pretends to be a map.
  if (!has) return <View style={{ height, backgroundColor: c.sunken }} />;

  // Same choices as native: homes get the neighborhood only; an approximate match gets the wider view.
  const caption = !imagery ? 'Neighborhood only · private home' : locationLabel(quality);
  return (
    <View style={{ height }}>
      {!imagery ? (
        <MapSnapshot lat={lat} lng={lng} zoom={14} privateHome attributionInset={bottomInset} style={{ height }} />
      ) : quality === 'non_exact' ? (
        <MapSnapshot lat={lat} lng={lng} zoom={15} watched={watched} smallPin attributionInset={bottomInset} style={{ height }} />
      ) : (
        <MapSnapshot lat={lat} lng={lng} zoom={17} watched={watched} attributionInset={bottomInset} style={{ height }} />
      )}
      <View pointerEvents="none" style={styles.topScrim} />
      <View pointerEvents="none" style={[styles.caption, { bottom: bottomInset + space.sm }]}>
        <Text variant="caption" style={styles.captionText} maxFontSizeMultiplier={1.2} numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Under the status bar the app draws in white: 30% at the top edge, clear by 96 pt, as on native.
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.2) 33%, rgba(0,0,0,0.08) 67%, rgba(0,0,0,0) 100%)',
  },
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
});
