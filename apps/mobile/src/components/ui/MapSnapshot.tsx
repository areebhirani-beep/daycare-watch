import { Image } from 'expo-image';
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';

import { useColors } from '@/theme';

import { MapPin } from './MapPin';
import { Text } from './Text';

// A real aerial photo of the daycare's location (Esri World Imagery, no key), built from tiles laid
// out in plain views. No native map, so it works in Expo Go and inside scrolling carousels.
// Tiles are fetched one zoom level deeper and drawn at half size, so they stay sharp on retina screens.
const TILE = 128;

function tileUrl(z: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

function project(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z * TILE;
  const r = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  };
}

type Props = {
  lat: number | null | undefined;
  lng: number | null | undefined;
  zoom?: number;
  watched?: boolean;
  /** Where the pin sits vertically, 0 = top, 1 = bottom. The place-page hero lifts it above the sheet. */
  pinY?: number;
  showPin?: boolean;
  /** Small pin for thumbnails; the large selected pin for heroes and cards. */
  smallPin?: boolean;
  /** Esri's terms: the credit shows on every image. 'short' is for thumbnails too small for the full line. */
  attribution?: boolean | 'short';
  /** Lifts the credit above anything that overlaps the bottom of the image (the place page's head card). */
  attributionInset?: number;
  style?: ViewStyle;
};

export function MapSnapshot({
  lat,
  lng,
  zoom = 15,
  watched,
  pinY = 0.5,
  showPin = true,
  smallPin = false,
  attribution = true,
  attributionInset = 0,
  style,
}: Props) {
  const c = useColors();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.round(width) !== size.w || Math.round(height) !== size.h) setSize({ w: Math.round(width), h: Math.round(height) });
  };

  const has = typeof lat === 'number' && typeof lng === 'number';

  const tiles: { key: string; uri: string; left: number; top: number }[] = [];
  if (has && size) {
    const z = zoom + 1;
    const p = project(lat, lng, z);
    const left = p.x - size.w / 2;
    const top = p.y - size.h * pinY;
    const max = 2 ** z;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
        if (ty < 0 || ty >= max) continue;
        const wx = ((tx % max) + max) % max;
        tiles.push({ key: `${z}/${wx}/${ty}`, uri: tileUrl(z, wx, ty), left: tx * TILE - left, top: ty * TILE - top });
      }
    }
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.root, { backgroundColor: c.sunken }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tiles.map((t) => (
        <Image
          key={t.key}
          source={{ uri: t.uri }}
          cachePolicy="memory-disk"
          transition={120}
          style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }}
        />
      ))}
      {has && size && showPin ? (
        <View style={[styles.pin, { top: size.h * pinY - 20, left: size.w / 2 - 20 }]} pointerEvents="none">
          <MapPin watched={watched} selected={!smallPin} />
        </View>
      ) : null}
      {has && attribution ? (
        <View style={[attribution === 'short' ? styles.attrShort : styles.attr, { bottom: (attribution === 'short' ? 3 : 6) + attributionInset }]}>
          <Text
            variant="caption"
            style={attribution === 'short' ? { fontSize: 7, lineHeight: 9, color: '#FFFFFF' } : { fontSize: 9, lineHeight: 12, color: '#FFFFFF' }}
            maxFontSizeMultiplier={1}
          >
            {attribution === 'short' ? '© Esri' : 'Imagery © Esri, Maxar'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  pin: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  attr: { position: 'absolute', right: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  attrShort: { position: 'absolute', right: 3, paddingHorizontal: 3, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.55)' },
});
