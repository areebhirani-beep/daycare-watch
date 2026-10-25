import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { prepareFlyover } from '../../../modules/look-around';

import { MapPin } from './MapPin';
import { MapSnapshot } from './MapSnapshot';

const DRIFT_DEG = 24;
const DRIFT_MS = 9000;
const START_HEADING = 20;
// react-native-maps says when MapKit starts drawing, never when the 3D tiles are in. So the same scene is drawn off
// screen (prepareFlyover) and the 3D view fades in once that's done; until then the still shows. A build without it
// waits SETTLE_MS; a scene that never finishes shows after GIVE_UP_MS anyway.
const SETTLE_MS = 1500;
const GIVE_UP_MS = 8000;
const FADE_MS = 400;
// Dark in both themes, like every picture's backing: a light flash before the picture would read as a broken map.
const PICTURE_BG = '#0B0B0C';

export { flyoverAllowed } from './flyover';

/**
 * Apple's 3D flyover of a real place, turning slowly like a drone shot. No touch and no labels; our pin
 * marks the building so the picture is unmistakably this place. Licensed centers with an exact geocode only (flyoverAllowed); the caller checks.
 * Android and web get a still aerial instead; Reduce Motion gets the 3D view without the drift.
 */
export function FlyoverHero({
  lat,
  lng,
  legalTop,
  bottomInset,
  pin = true,
  watched,
  stillCredit = true,
  onReady,
  style,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Moves Apple's required Maps mark up to this y (from the top) when the bottom is covered by content. */
  legalTop?: number;
  /**
   * Lifts the building above content that covers the bottom of the view: MapKit centers the camera above
   * this margin. With it set, MapKit ignores legalLabelInsets and puts its legal mark about 38 pt above the
   * margin, so the caller picks a margin that leaves that spot clear.
   */
  bottomInset?: number;
  /** Our white pin on the point (the same one the aerial and the map use). */
  pin?: boolean;
  watched?: boolean;
  /**
   * Until MapKit has drawn, an Esri still of the same spot sits underneath (never a blank grey frame). Esri's terms
   * put its credit on it; a caller that already shows the credit (the gallery's chip) turns this off.
   */
  stillCredit?: boolean;
  /** The 3D view is on screen. A caption that says "3D view, Apple Maps" waits for this; before it, the picture is Esri's. */
  onReady?: () => void;
  style?: ViewStyle;
}) {
  const map = useRef<MapView>(null);
  // Android and web have no 3D view: a still aerial. Reduce Motion keeps the 3D view and stops the drift,
  // so every caption that says "3D view · Apple Maps" stays true.
  const still = Platform.OS !== 'ios';
  const [drift, setDrift] = useState(true);
  const heading = useRef(START_HEADING);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const h = size.h;
  const [mapReady, setMapReady] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const shown = useSharedValue(0);
  const fadeIn = useAnimatedStyle(() => ({ opacity: shown.value }));

  const sized = size.w > 0 && size.h > 0;
  useEffect(() => {
    if (still || lat == null || lng == null || !sized) return;
    let live = true;
    const done = () => live && setDrawn(true);
    const giveUp = setTimeout(done, GIVE_UP_MS);
    let wait: ReturnType<typeof setTimeout> | undefined;
    prepareFlyover(lat, lng, size.w, size.h)
      .then((ok) => (ok === null ? (wait = setTimeout(done, SETTLE_MS)) : done()))
      .catch(done);
    return () => {
      live = false;
      clearTimeout(giveUp);
      clearTimeout(wait);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per spot, when the view first has a size
  }, [still, lat, lng, sized]);

  const on = mapReady && drawn;
  useEffect(() => {
    if (!on) return;
    shown.set(withTiming(1, { duration: FADE_MS, reduceMotion: ReduceMotion.System }));
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once, when the 3D view is complete
  }, [on]);

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

  if (lat == null || lng == null) return <View style={[StyleSheet.absoluteFill, { backgroundColor: PICTURE_BG }, style]} />;
  if (still) return <MapSnapshot lat={lat} lng={lng} zoom={17} showPin={pin} watched={watched} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, ...style }} />;

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: PICTURE_BG }, style]}
      onLayout={(e) => setSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The same spot from above, with our pin where the 3D view puts it (above the bottom margin). Ink, not grey,
          while its own tiles load, so a cold first launch goes dark -> picture, never a flat grey map. */}
      <MapSnapshot
        lat={lat}
        lng={lng}
        zoom={17}
        showPin={pin}
        watched={watched}
        pinY={h > 0 && bottomInset ? (h - bottomInset) / 2 / h : 0.5}
        attribution={stillCredit}
        attributionTop={legalTop}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: PICTURE_BG }}
      />
      <Animated.View style={[StyleSheet.absoluteFill, fadeIn]}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          onMapReady={() => setMapReady(true)}
          mapType="satelliteFlyover"
          initialCamera={{ center: { latitude: lat, longitude: lng }, pitch: 56, heading: START_HEADING, altitude: 340, zoom: 17 }}
          legalLabelInsets={{ top: 0, left: 16, right: 0, bottom: legalTop != null && h > 0 ? h - legalTop - 22 : 10 }}
          mapPadding={bottomInset ? { top: 0, left: 0, right: 0, bottom: bottomInset } : undefined}
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
      </Animated.View>
    </View>
  );
}
