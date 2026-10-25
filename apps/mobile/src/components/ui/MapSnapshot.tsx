import { Image } from 'expo-image';
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';

import { useColors, useIsDark } from '@/theme';

import { MapPin } from './MapPin';
import { Text } from './Text';

// A real aerial photo of the daycare's location (Esri World Imagery, no key), built from tiles laid
// out in plain views. No native map, so it works in Expo Go and inside scrolling carousels.
// Tiles are fetched one zoom level deeper and drawn at half size, so they stay sharp on retina screens.
const TILE = 128;

// Home daycares are private residences (privacy rule: no photo or exact point for a family's house; callers decide with lib/imagery):
// never aerial imagery, never a pin on the house. A grey street map at neighborhood zoom with an area circle.
const HOME_MAX_ZOOM = 14;
const AREA_RADIUS_M = 400;

type Base = 'imagery' | 'light' | 'dark';
const BASE_PATH: Record<Base, string> = {
  imagery: 'World_Imagery',
  light: 'Canvas/World_Light_Gray_Base',
  dark: 'Canvas/World_Dark_Gray_Base',
};

function tileUrl(base: Base, z: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/${BASE_PATH[base]}/MapServer/tile/${z}/${y}/${x}`;
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
  /** A private residence: street map, zoom capped at 14, area circle, no pin. */
  privateHome?: boolean;
  style?: ViewStyle;
};

export function MapSnapshot({
  lat: rawLat,
  lng: rawLng,
  zoom = 15,
  watched,
  pinY = 0.5,
  showPin = true,
  smallPin = false,
  attribution = true,
  attributionInset = 0,
  privateHome = false,
  style,
}: Props) {
  const c = useColors();
  const isDark = useIsDark();
  const base: Base = privateHome ? (isDark ? 'dark' : 'light') : 'imagery';

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.round(width) !== size.w || Math.round(height) !== size.h) setSize({ w: Math.round(width), h: Math.round(height) });
  };

  // A home's circle centres on a 0.005° grid point (~500 m), never on the geocoded house.
  const snap = (v: number | null | undefined) => (privateHome && typeof v === 'number' ? Math.round(v / 0.005) * 0.005 : v);
  const lat = snap(rawLat);
  const lng = snap(rawLng);
  const has = typeof lat === 'number' && typeof lng === 'number';

  const tiles: { key: string; uri: string; left: number; top: number }[] = [];
  if (has && size) {
    const z = (privateHome ? Math.min(zoom, HOME_MAX_ZOOM) : zoom) + 1;
    const p = project(lat, lng, z);
    const left = p.x - size.w / 2;
    const top = p.y - size.h * pinY;
    const max = 2 ** z;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
        if (ty < 0 || ty >= max) continue;
        const wx = ((tx % max) + max) % max;
        tiles.push({ key: `${base}/${z}/${wx}/${ty}`, uri: tileUrl(base, z, wx, ty), left: tx * TILE - left, top: ty * TILE - top });
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
      {has && size && privateHome ? (
        <View
          pointerEvents="none"
          style={[
            styles.area,
            (() => {
              // Points per metre at this latitude and zoom, so the circle is a true ~400 m area.
              const metersPerPoint = (156543.03392 * Math.cos(((lat as number) * Math.PI) / 180)) / 2 ** Math.min(zoom, HOME_MAX_ZOOM);
              const r = Math.max(18, Math.min(AREA_RADIUS_M / metersPerPoint, Math.min(size.w, size.h) * 0.42));
              return { width: r * 2, height: r * 2, borderRadius: r, left: size.w / 2 - r, top: size.h * pinY - r, borderColor: c.ink, backgroundColor: c.scrim };
            })(),
          ]}
        />
      ) : null}
      {has && size && showPin && !privateHome ? (
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
            {attribution === 'short' ? '© Esri' : privateHome ? 'Map © Esri, HERE, Garmin, OSM' : 'Imagery © Esri, Maxar'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  area: { position: 'absolute', borderWidth: 2, opacity: 0.55 },
  pin: { position: 'absolute', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  attr: { position: 'absolute', right: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  attrShort: { position: 'absolute', right: 3, paddingHorizontal: 3, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.55)' },
});
