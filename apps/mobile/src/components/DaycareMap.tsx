import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { plural } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { mapStyle, pinPaint, useColors, useIsDark } from '@/theme';

type LatLng = { lat: number; lng: number };

/**
 * Daycares near the parent as uniform pins. Pins never encode findings.
 * Loaded only outside Expo Go (see lib/runtime.ts), because Expo Go ships without MapLibre.
 */
export function DaycareMap({
  rows,
  watchedIds,
  center,
  fallbackCenter,
  onPick,
}: {
  rows: DaycareRow[];
  watchedIds: Set<number>;
  center: LatLng | null;
  fallbackCenter: LatLng;
  onPick: (row: DaycareRow) => void;
}) {
  const c = useColors();
  const isDark = useIsDark();
  const style = useMemo(() => mapStyle(isDark), [isDark]);
  const shape = useMemo(() => toGeoJSON(rows, watchedIds), [rows, watchedIds]);
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={style}
      logo={false}
      attribution
      attributionPosition={{ bottom: 6, right: 6 }}
      accessibilityLabel={`Map of ${plural(rows.length, 'daycare')} near you. The list below has the same daycares.`}
    >
      <Camera
        initialViewState={{ center: [fallbackCenter.lng, fallbackCenter.lat], zoom: 10 }}
        {...(center ? { center: [center.lng, center.lat] as [number, number], zoom: 11.5, duration: 0 } : {})}
      />
      <GeoJSONSource
        id="daycares"
        data={shape}
        onPress={(e) => {
          const id = e.nativeEvent.features[0]?.properties?.operation_id as number | undefined;
          const row = rows.find((d) => d.operation_id === id);
          if (row) onPick(row);
        }}
      >
        <Layer id="pins" type="circle" paint={pinPaint(c)} />
      </GeoJSONSource>
    </Map>
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
