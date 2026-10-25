import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { imageryAllowed } from '@/lib/imagery';
import type { DaycareHeader } from '@/lib/types';
import { useColors } from '@/theme';

import { MapPin } from './MapPin';
import { MapSnapshot } from './MapSnapshot';

const DRIFT_DEG = 24;
const DRIFT_MS = 9000;
const START_HEADING = 20;

/** A 3D view only for a licensed center whose address geocoded exactly. */
export function flyoverAllowed(d: Pick<DaycareHeader, 'operation_type' | 'geocode_quality'> | null | undefined): boolean {
  return Boolean(d && imageryAllowed(d.operation_type) && d.geocode_quality === 'exact');
}

/**
 * Apple's 3D flyover of a real place, turning slowly like a drone shot. No touch and no labels; our pin
 * marks the building so the picture is unmistakably this place. Licensed centers with an exact geocode only (flyoverAllowed); the caller checks.
 * Android and web get a still aerial instead; Reduce Motion gets the 3D view without the drift.
 */
export function FlyoverHero({
  lat,
  lng,
  legalTop,
  pin = true,
  watched,
  style,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Moves Apple's required Maps mark up to this y (from the top) when the bottom is covered by content. */
  legalTop?: number;
  /** Our white pin on the point (the same one the aerial and the map use). */
  pin?: boolean;
  watched?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const map = useRef<MapView>(null);
  // Android and web have no 3D view: a still aerial. Reduce Motion keeps the 3D view and stops the drift,
  // so every caption that says "3D view · Apple Maps" stays true.
  const still = Platform.OS !== 'ios';
  const [drift, setDrift] = useState(true);
  const heading = useRef(START_HEADING);
  const [h, setH] = useState(0);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => r && setDrift(false));
  }, []);

  useEffect(() => {
    if (still || !drift || lat == null || lng == null) return;
    const turn = () => {
      heading.current += DRIFT_DEG;
      map.current?.animateCamera({ heading: heading.current }, { duration: DRIFT_MS });
    };
    const first = setTimeout(turn, 600);
    const id = setInterval(turn, DRIFT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [still, drift, lat, lng]);

  if (lat == null || lng == null) return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0B0C' }, style]} />;
  if (still) return <MapSnapshot lat={lat} lng={lng} zoom={17} showPin={pin} watched={watched} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, ...style }} />;

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: c.ink }, style]}
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        mapType="satelliteFlyover"
        initialCamera={{ center: { latitude: lat, longitude: lng }, pitch: 56, heading: START_HEADING, altitude: 340, zoom: 17 }}
        legalLabelInsets={{ top: 0, left: 16, right: 0, bottom: legalTop != null && h > 0 ? h - legalTop - 22 : 10 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsPointsOfInterests={false}
        showsBuildings
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
      >
        {pin ? (
          <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <MapPin kind="center" watched={watched} selected />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
