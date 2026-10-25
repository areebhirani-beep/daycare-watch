import { useQueries } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { photoMonth, photosEnabled, photoUrl } from '@/lib/mapillary';
import type { Photo } from '@/lib/types';
import { fade, haptic, motion, radius, space, useColors, useIsDark } from '@/theme';

import { FlyoverHero } from './FlyoverHero';
import { AreaPin, type PinKind } from './MapPin';
import { MapSnapshot } from './MapSnapshot';
import { Text } from './Text';

/** How the pin was placed. Even "exact" is street-range interpolation, never a rooftop. */
export type GeocodeQuality = 'state' | 'exact' | 'non_exact';

export function locationLabel(q: GeocodeQuality | null | undefined): string {
  switch (q) {
    case 'state':
      return 'Location from the state record';
    case 'exact':
      return 'Placed from the street address';
    case 'non_exact':
      return 'Approximate location';
    default:
      return 'Area around the address';
  }
}

type Page =
  | { key: string; kind: 'photo'; photo: Photo; url: string | undefined }
  | { key: 'flyover'; kind: 'flyover' }
  | { key: 'aerial'; kind: 'aerial' }
  | { key: 'street'; kind: 'street' }
  | { key: 'area'; kind: 'area' }
  | { key: 'approx'; kind: 'approx' };

const PHOTO_CREDIT = '© Mapillary contributors · CC BY-SA';
const ESRI_CREDIT = 'Imagery © Esri, Maxar';

function caption(p: Page, quality: GeocodeQuality | null | undefined): { text: string; credit?: string; date?: string } {
  switch (p.kind) {
    case 'photo':
      return { text: 'Street view near the address', credit: PHOTO_CREDIT, date: photoMonth(p.photo) };
    case 'flyover':
      return { text: '3D view · Apple Maps' };
    case 'aerial':
      return { text: locationLabel(quality), credit: ESRI_CREDIT };
    case 'street':
      return { text: 'Street View · Google Maps', credit: ESRI_CREDIT };
    case 'area':
      return { text: 'Neighborhood only · private home', credit: 'Map © Esri' };
    case 'approx':
      return { text: 'Approximate location' };
  }
}

/** Google's own Street View at this point, opened in Google Maps or the browser. */
function streetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

/**
 * The place-page hero, so a parent can tell it's the right place. A licensed center with an exact address gets
 * Apple's 3D view first (the aerial with its pin where there is none), then street photos (up to 3, newest first,
 * each with its month and credit), the aerial, and a door to Google Street View.
 * An address that only matched approximately gets a plain map with an area, never a point or a photo.
 * Home daycares (private residences) get one neighborhood map: no photo, no pin, no 3D view.
 * Tap a picture to see it full screen.
 */
export function PlaceGallery({
  lat,
  lng,
  quality,
  imagery,
  flyover,
  photos = [],
  kind = 'center',
  watched,
  height,
  bottomInset = 0,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  quality?: GeocodeQuality | null;
  /** False for home daycares (lib/imagery): one neighborhood street map, no photo, no pin, no flyover. */
  imagery: boolean;
  /** flyoverAllowed(daycare): a licensed center whose address geocoded exactly. Photos follow the same rule. */
  flyover: boolean;
  photos?: Photo[];
  kind?: PinKind;
  /** Turns our pin yellow on the 3D view and the aerial, as on the map. */
  watched?: boolean;
  height: number;
  /** Space taken by whatever overlaps the bottom of the hero (the head card). */
  bottomInset?: number;
}) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  // A photo's caption, date and credit wait for the photo itself; one that won't load drops out.
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const onPhoto = (id: string, ok: boolean) => (ok ? setLoaded : setBroken)((prev) => new Set(prev).add(id));
  const x = useSharedValue(0);
  const has = typeof lat === 'number' && typeof lng === 'number';

  // Photo URLs are looked up now (three small calls) so swiping never waits; a photo that fails drops out.
  const shown = flyover && photosEnabled ? photos.slice(0, 3) : [];
  const urls = useQueries({
    queries: shown.map((p) => ({
      queryKey: ['mapillary', p.image_id],
      queryFn: ({ signal }: { signal: AbortSignal }) => photoUrl(p.image_id, signal),
      staleTime: 30 * 60_000,
      retry: 1,
    })),
  });

  const pages: Page[] = !imagery
    ? [{ key: 'area', kind: 'area' }]
    : quality === 'non_exact'
      ? [{ key: 'approx', kind: 'approx' }]
      : (() => {
          // Page one must unmistakably be this place: the 3D view, or the aerial with its pin. Photos follow.
          const photoPages = shown.flatMap((p, i): Page[] =>
            urls[i]?.isError || broken.has(p.image_id) ? [] : [{ key: p.image_id, kind: 'photo', photo: p, url: urls[i]?.data }],
          );
          const aerial: Page = { key: 'aerial', kind: 'aerial' };
          const street: Page[] = flyover ? [{ key: 'street', kind: 'street' }] : [];
          return flyover && Platform.OS === 'ios'
            ? [{ key: 'flyover', kind: 'flyover' } as const, ...photoPages, aerial, ...street]
            : [aerial, ...photoPages, ...street];
        })();
  const current = Math.min(page, pages.length - 1);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  // The state record has no map location: a plain band, no caption, nothing that pretends to be a map.
  if (!has) return <View style={{ height, backgroundColor: c.sunken }} />;

  const open = (i: number) => {
    const p = pages[i];
    if (!p) return;
    if (p.kind === 'street') {
      haptic.select();
      void Linking.openURL(streetViewUrl(lat, lng));
    } else if (p.kind === 'photo' || p.kind === 'aerial' || p.kind === 'flyover') {
      setViewer(i);
    }
  };

  const cap = caption(pages[current]!, quality);
  const at = pages[current]!;
  const captionReady = at.kind !== 'photo' || loaded.has(at.key);
  const onPicture = pages[current]!.kind !== 'area' && pages[current]!.kind !== 'approx';

  return (
    <View style={{ height, backgroundColor: '#0B0B0C' }}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEnabled={pages.length > 1}
      >
        {pages.map((p, i) => (
          <Pressable
            key={p.key}
            style={{ width, height }}
            onPress={() => open(i)}
            disabled={p.kind === 'area' || p.kind === 'approx'}
            accessibilityRole={p.kind === 'street' ? 'link' : 'imagebutton'}
            accessibilityLabel={
              p.kind === 'street'
                ? 'Open Google Street View at this address'
                : `${caption(p, quality).text}${p.kind === 'photo' ? `, taken ${photoMonth(p.photo)}` : ''}. Opens full screen.`
            }
          >
            {/* The 3D view mounts only when it's on screen or next, so it loads on view, not on open. */}
            <PageBody
              page={p}
              lat={lat}
              lng={lng}
              kind={kind}
              live={Math.abs(i - current) <= 1}
              bottomInset={bottomInset}
              height={height}
              watched={watched}
              onPhoto={onPhoto}
            />
          </Pressable>
        ))}
      </Animated.ScrollView>

      {onPicture ? (
        <>
          <View pointerEvents="none" style={styles.topScrim} />
          <Scrim height={height * 0.35} />
        </>
      ) : null}

      <View pointerEvents="none" style={[styles.bottom, { bottom: bottomInset + space.sm }]}>
        <Animated.View key={`${at.key}:${captionReady}`} entering={fade(motion.fast)} style={[styles.captionCol, !captionReady && styles.hidden]}>
          {cap.date ? (
            <View style={styles.dateChip}>
              <Text variant="caption" style={styles.white} maxFontSizeMultiplier={1.3}>
                {cap.date}
              </Text>
            </View>
          ) : null}
          <View style={onPicture ? null : styles.mapPill}>
            <Text variant="caption" style={styles.white} maxFontSizeMultiplier={1.3} numberOfLines={1}>
              {cap.text}
            </Text>
            {cap.credit ? (
              <Text variant="caption" style={[styles.white, styles.credit]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {cap.credit}
              </Text>
            ) : null}
          </View>
        </Animated.View>
        {pages.length > 1 ? <Dots count={pages.length} x={x} width={width} /> : null}
      </View>

      {viewer !== null ? (
        <Viewer
          pages={pages.filter((p) => p.kind === 'photo' || p.kind === 'aerial' || p.kind === 'flyover')}
          start={pages[viewer]!.key}
          lat={lat}
          lng={lng}
          kind={kind}
          quality={quality}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </View>
  );
}

function PageBody({
  page,
  lat,
  lng,
  kind,
  live,
  bottomInset,
  height,
  full = false,
  watched,
  onPhoto,
}: {
  page: Page;
  lat: number;
  lng: number;
  kind: PinKind;
  live: boolean;
  bottomInset: number;
  height: number;
  full?: boolean;
  watched?: boolean;
  onPhoto?: (imageId: string, ok: boolean) => void;
}) {
  const c = useColors();
  const isDark = useIsDark();
  switch (page.kind) {
    case 'photo':
      return page.url ? (
        <Image
          source={{ uri: page.url }}
          style={StyleSheet.absoluteFill}
          contentFit={full ? 'contain' : 'cover'}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          onLoad={() => onPhoto?.(page.photo.image_id, true)}
          onError={() => onPhoto?.(page.photo.image_id, false)}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1C1C1E' }]} />
      );
    case 'flyover':
      return live ? <FlyoverHero lat={lat} lng={lng} watched={watched} legalTop={full ? undefined : height - bottomInset - 64} /> : null;
    case 'aerial':
      return <MapSnapshot lat={lat} lng={lng} zoom={17} watched={watched} attribution={false} style={{ height }} />;
    case 'street':
      return (
        <View style={StyleSheet.absoluteFill}>
          <MapSnapshot lat={lat} lng={lng} zoom={18} attribution={false} showPin={false} style={{ height }} />
          <View style={[StyleSheet.absoluteFill, styles.streetCover]}>
            <View style={[styles.streetButton, { backgroundColor: c.surface }]}>
              <Text variant="headline">Open Street View</Text>
              <Icon name="external" size={15} color={c.ink} />
            </View>
          </View>
        </View>
      );
    case 'area':
      return <MapSnapshot lat={lat} lng={lng} zoom={14} privateHome attribution={false} style={{ height }} />;
    case 'approx':
      return (
        <MapView
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          showsPointsOfInterests={false}
          legalLabelInsets={{ top: 0, left: 0, right: space.lg, bottom: bottomInset + space.sm }}
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <AreaPin kind={kind} selected />
          </Marker>
        </MapView>
      );
  }
}

/** Bottom 35% of the hero, stepped from clear to 45% black, so white type reads on any photo. */
function Scrim({ height }: { height: number }) {
  const steps = [0.08, 0.18, 0.3, 0.45];
  return (
    <View pointerEvents="none" style={[styles.scrim, { height }]}>
      {steps.map((o) => (
        <View key={o} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${o})` }} />
      ))}
    </View>
  );
}

/** Page dots that follow the finger: the current one stretches into a capsule as it scrolls. */
function Dots({ count, x, width }: { count: number; x: SharedValue<number>; width: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} i={i} x={x} width={width} />
      ))}
    </View>
  );
}

function Dot({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const at = x.value / width;
    return {
      width: interpolate(at, [i - 1, i, i + 1], [6, 16, 6], Extrapolation.CLAMP),
      opacity: interpolate(at, [i - 1, i, i + 1], [0.5, 1, 0.5], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

/** Full-screen black viewer: swipe the same pictures, pinch a photo, caption, date and credit at the bottom. */
function Viewer({
  pages,
  start,
  lat,
  lng,
  kind,
  quality,
  onClose,
}: {
  pages: Page[];
  start: string;
  lat: number;
  lng: number;
  kind: PinKind;
  quality: GeocodeQuality | null | undefined;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const first = Math.max(
    0,
    pages.findIndex((p) => p.key === start),
  );
  const [page, setPage] = useState(first);
  const cap = pages[page] ? caption(pages[page], quality) : null;

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.viewer} accessibilityViewIsModal>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: first * width, y: 0 }}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {pages.map((p, i) =>
            p.kind === 'photo' ? (
              <ScrollView
                key={p.key}
                style={{ width, height }}
                maximumZoomScale={3}
                minimumZoomScale={1}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ width, height }}>
                  <PageBody page={p} lat={lat} lng={lng} kind={kind} live bottomInset={0} height={height} full />
                </View>
              </ScrollView>
            ) : (
              <View key={p.key} style={{ width, height }}>
                <PageBody page={p} lat={lat} lng={lng} kind={kind} live={Math.abs(i - page) <= 1} bottomInset={0} height={height} full />
              </View>
            ),
          )}
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={[styles.close, { top: insets.top + space.sm }]}
        >
          <Icon name="close" size={18} color="#FFFFFF" />
        </Pressable>

        {cap ? (
          <View style={[styles.viewerBar, { paddingBottom: insets.bottom + space.md }]} pointerEvents="none">
            {cap.date ? (
              <Text variant="callout" style={styles.white}>
                {cap.date}
              </Text>
            ) : null}
            <Text variant="callout" style={styles.white}>
              {cap.text}
            </Text>
            {cap.credit ? (
              <Text variant="caption" style={[styles.white, styles.credit]}>
                {cap.credit}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bottom: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  captionCol: { flexShrink: 1, alignItems: 'flex-start', gap: 6 },
  white: { color: '#FFFFFF' },
  hidden: { opacity: 0 },
  credit: { opacity: 0.85 },
  dateChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.5)' },
  mapPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Keeps the status bar readable over a bright sky.
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 64, backgroundColor: 'rgba(0,0,0,0.22)' },
  dots: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginBottom: 2,
  },
  dot: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  streetCover: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  streetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
  viewer: { flex: 1, backgroundColor: '#000000' },
  close: {
    position: 'absolute',
    left: space.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  viewerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.lg, gap: 2, backgroundColor: 'rgba(0,0,0,0.55)' },
});
