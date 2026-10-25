import { useQueries, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { type AccessibilityActionEvent, Modal, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useAppWidth } from '@/lib/layout';
import { photoMonth, photosEnabled, photoUrl } from '@/lib/mapillary';
import type { Photo } from '@/lib/types';

import { type Facing, lookAroundAvailable, lookAroundSnapshot, presentLookAround } from '../../../modules/look-around';
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
  | { key: 'lookaround'; kind: 'lookaround'; uri: string; facing: Facing }
  | { key: string; kind: 'photo'; photo: Photo; url: string }
  | { key: 'flyover'; kind: 'flyover' }
  | { key: 'aerial'; kind: 'aerial' }
  | { key: 'area'; kind: 'area' }
  | { key: 'approx'; kind: 'approx' };

// Esri's own credit for World Imagery (MapServer copyrightText): Esri, Vantor, Earthstar Geographics.
const ESRI_CREDIT = 'Imagery © Esri, Vantor, Earthstar Geographics';
const POINT_CAVEAT = 'Apple does not say when it was taken, and it may not show this daycare.';

type Caption = {
  /** The chip on the hero: the source, and the month for a Mapillary photo. */
  chip: string;
  /** A second line, on the plain maps only. */
  credit?: string;
  /** What VoiceOver and TalkBack read for the page. */
  label: string;
  /** Under the picture in the full-screen viewer: the photographer and licence, then the month; or a caveat. */
  viewer?: string[];
};

function longMonth(p: Pick<Photo, 'captured_at'>): string {
  return new Date(p.captured_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Chicago' });
}

function caption(p: Page, name: string, flyoverOn = true): Caption {
  switch (p.kind) {
    case 'lookaround':
      // No same-name place: this is only the street at the state's address point, and may show a neighbour.
      if (p.facing === 'point') {
        return {
          chip: 'Street at this address · Apple Look Around',
          label: `The street at the state's address for ${name}, from Apple Look Around. ${POINT_CAVEAT}`,
          viewer: [POINT_CAVEAT],
        };
      }
      // Apple's imagery can predate the daycare (one TX-04 center shows the previous tenant's sign), and Apple gives
      // no capture date, so the page says so instead of implying the picture is current.
      return {
        chip: 'Look Around · Apple Maps · date unknown',
        label: `Street photo of ${name}, Apple Look Around. Apple does not say when this picture was taken.`,
      };
    case 'photo':
      return {
        chip: `Photo · Mapillary · ${photoMonth(p.photo)}`,
        label: `Street photo of ${name}, Mapillary, ${longMonth(p.photo)}`,
        viewer: [`© ${p.photo.creator ?? 'Mapillary contributors'} · CC BY-SA 4.0 · Mapillary`, `Taken ${longMonth(p.photo)}`],
      };
    case 'flyover':
      // Until MapKit has drawn, the picture is the Esri still under it (FlyoverHero), so the chip says so.
      if (!flyoverOn) return { chip: ESRI_CREDIT, label: `Aerial view of ${name}` };
      return { chip: '3D view · Apple Maps', label: `3D view of ${name} from above, Apple Maps` };
    case 'aerial':
      return { chip: ESRI_CREDIT, label: `Aerial view of ${name}` };
    case 'area':
      return { chip: 'Neighborhood only · private home', credit: 'Map © Esri', label: 'Map of the neighborhood. This is a private home, so no exact location is shown.' };
    case 'approx':
      return { chip: 'Approximate location', label: `Map of the area around ${name}. The address matched only approximately.` };
  }
}

/**
 * The place-page hero, so a parent can tell it's the right place. A licensed center with an exact address gets up to
 * two street-level pictures of the building (Apple Look Around where Apple matched the daycare by name, then
 * hand-checked Mapillary photos, each with its month and credit), then ONE view from above: Apple's 3D view on
 * iPhone, the aerial elsewhere. No picture of the building means the view from above alone, never a placeholder.
 * An address that only matched approximately gets a plain map with an area, never a point or a photo.
 * Home daycares (private residences) get one neighborhood map: no photo, no pin, no 3D view.
 * Tap Look Around to walk the street in Apple's viewer; tap any other picture to see it full screen.
 */
export function PlaceGallery({
  id,
  name = 'this daycare',
  lat,
  lng,
  quality,
  imagery,
  flyover,
  photos = [],
  streetChecked = false,
  kind = 'center',
  watched,
  height,
  bottomInset = 0,
}: {
  /** The daycare's operation id: Look Around snapshots are cached on the phone under it. */
  id?: number;
  /** The state's name, which Apple Maps matches to frame Look Around on the building. */
  name?: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  quality?: GeocodeQuality | null;
  /** False for home daycares (lib/imagery): one neighborhood street map, no photo, no pin, no flyover. */
  imagery: boolean;
  /** flyoverAllowed(daycare): a licensed center whose address geocoded exactly. Photos follow the same rule. */
  flyover: boolean;
  photos?: Photo[];
  /** A person checked that Apple's street at the address point is worth showing (platform's list). Off by default. */
  streetChecked?: boolean;
  kind?: PinKind;
  /** Turns our pin yellow on the 3D view and the aerial, as on the map. */
  watched?: boolean;
  height: number;
  /** Space taken by whatever overlaps the bottom of the hero (the head card). */
  bottomInset?: number;
}) {
  const c = useColors();
  const width = useAppWidth();
  const reduced = useReducedMotion();
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const [page, setPage] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  // Until the parent swipes, pictures of the building that arrive late slide in ahead of the view from above.
  // After a swipe they still join, but the page on screen stays put.
  const swiped = useRef(false);
  const visible = useRef<string | null>(null);
  // A photo that won't load drops out.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const [flyoverOn, setFlyoverOn] = useState(false);
  const onPhoto = (imageId: string, ok: boolean) => {
    if (!ok) setBroken((prev) => new Set(prev).add(imageId));
  };
  const x = useSharedValue(0);
  const has = typeof lat === 'number' && typeof lng === 'number';

  // Apple's street-level picture, made once per daycare on the phone: the building where Apple matched the daycare by
  // name, otherwise the street at the state's address point, labelled as only that (it can show a neighbour).
  const look = useQuery({
    queryKey: ['lookaround', id, streetChecked],
    queryFn: () =>
      lookAroundSnapshot(lat!, lng!, {
        name,
        cacheKey: String(id),
        width: Math.round(width * Math.min(PixelRatio.get(), 2)),
        height: Math.round(height * Math.min(PixelRatio.get(), 2)),
        allowPoint: streetChecked,
      }),
    enabled: lookAroundAvailable && flyover && has && id != null,
    staleTime: Infinity,
    retry: 0,
  });
  const lookPage: Page | null = look.data ? { key: 'lookaround', kind: 'lookaround', uri: look.data.uri, facing: look.data.facing } : null;

  // Only hand-checked photos reach the record. Their URLs are looked up now so swiping never waits, and a photo
  // joins the carousel only once its URL is in.
  const shown = flyover && photosEnabled ? photos.slice(0, 2) : [];
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
          // Pictures of the building first (two at most), then one view from above with our pin on the place.
          const photoPages = shown.flatMap((p, i): Page[] => {
            const url = urls[i]?.data;
            return url && !broken.has(p.image_id) ? [{ key: p.image_id, kind: 'photo', photo: p, url }] : [];
          });
          const above: Page = flyover && Platform.OS === 'ios' ? { key: 'flyover', kind: 'flyover' } : { key: 'aerial', kind: 'aerial' };
          // Order: pictures of the building (Apple's same-name place, hand-checked photos), then the street at the address.
          const building = lookPage?.facing === 'place' ? [lookPage] : [];
          const street = lookPage?.facing === 'point' ? [lookPage] : [];
          return [...building, ...photoPages, ...street].slice(0, 2).concat(above);
        })();
  const keys = pages.map((p) => p.key).join('|');

  // Pages changed under the parent: before a swipe show the first picture; after one, keep the page they are on.
  useEffect(() => {
    const at = visible.current ? pages.findIndex((p) => p.key === visible.current) : -1;
    const next = swiped.current && at >= 0 ? at : 0;
    setPage(next);
    visible.current = pages[next]?.key ?? null;
    scroller.current?.scrollTo({ x: next * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the set of pages changes, not on every render
  }, [keys, width]);

  const current = Math.min(page, pages.length - 1);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  // The state record has no map location: a plain band, no caption, nothing that pretends to be a map.
  if (!has) return <View style={{ height, backgroundColor: c.sunken }} />;

  const go = (i: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, i));
    swiped.current = true;
    visible.current = pages[next]!.key;
    setPage(next);
    scroller.current?.scrollTo({ x: next * width, animated: !reduced });
  };

  const open = (i: number) => {
    const p = pages[i];
    if (!p) return;
    if (p.kind === 'lookaround' && p.facing === 'place') {
      haptic.select();
      void presentLookAround(lat, lng, name);
    } else if (p.kind === 'lookaround' || p.kind === 'photo' || p.kind === 'aerial' || p.kind === 'flyover') {
      // The street at the address opens in our viewer, so its caveat stays under the picture.
      setViewer(i);
    }
  };

  const at = pages[current]!;
  const cap = caption(at, name, flyoverOn);
  const onPicture = at.kind !== 'area' && at.kind !== 'approx';
  const street = at.kind === 'lookaround' || at.kind === 'photo';
  const opens = onPicture;
  const many = pages.length > 1;

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') go(current + 1);
    else if (e.nativeEvent.actionName === 'decrement') go(current - 1);
    else if (e.nativeEvent.actionName === 'activate' && opens) open(current);
  };

  return (
    // One element for VoiceOver and TalkBack: it reads the picture on screen, swipe up or down to change it,
    // double-tap to open it.
    <View
      style={{ height, backgroundColor: '#0B0B0C' }}
      accessible
      accessibilityRole={many ? 'adjustable' : opens ? 'imagebutton' : 'image'}
      accessibilityLabel={cap.label}
      accessibilityValue={many ? { text: `Picture ${current + 1} of ${pages.length}` } : undefined}
      accessibilityHint={opens ? (at.kind === 'lookaround' && at.facing === 'place' ? 'Opens Look Around.' : 'Opens full screen.') : undefined}
      accessibilityActions={[
        ...(many ? [{ name: 'increment' as const }, { name: 'decrement' as const }] : []),
        ...(opens ? [{ name: 'activate' as const }] : []),
      ]}
      onAccessibilityAction={onAction}
    >
      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          swiped.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          visible.current = pages[i]?.key ?? null;
          setPage(i);
        }}
        scrollEnabled={many}
      >
        {pages.map((p, i) => (
          <Pressable key={p.key} style={{ width, height }} onPress={() => open(i)} disabled={p.kind === 'area' || p.kind === 'approx'}>
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
              fadeMs={reduced ? 0 : motion.base}
              onPhoto={onPhoto}
              onFlyover={() => setFlyoverOn(true)}
            />
          </Pressable>
        ))}
      </Animated.ScrollView>

      {onPicture ? (
        <>
          <Scrim height={TOP_SCRIM_H} steps={TOP_SCRIM} edge="top" />
          {street ? <Scrim height={height * 0.28} steps={PHOTO_SCRIM} /> : <Scrim height={height * 0.35} steps={ABOVE_SCRIM} />}
        </>
      ) : null}

      <View pointerEvents="none" style={[styles.bottom, { bottom: bottomInset + space.sm }]}>
        <Animated.View key={at.key} entering={fade(motion.fast)} style={[styles.chip, !onPicture && styles.mapChip]}>
          {/* Two lines at most: Esri's full credit can wrap on the smallest iPhone instead of being cut. */}
          <Text variant="caption" style={styles.white} maxFontSizeMultiplier={1.3} numberOfLines={2}>
            {cap.chip}
          </Text>
          {cap.credit ? (
            <Text variant="caption" style={[styles.white, styles.credit]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
              {cap.credit}
            </Text>
          ) : null}
        </Animated.View>
        {many ? <Dots count={pages.length} x={x} width={width} /> : null}
      </View>

      {viewer !== null ? (
        <Viewer
          pages={pages.filter((p) => (p.kind === 'lookaround' && p.facing === 'point') || p.kind === 'photo' || p.kind === 'aerial' || p.kind === 'flyover')}
          start={pages[viewer]!.key}
          name={name}
          lat={lat}
          lng={lng}
          kind={kind}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </View>
  );
}

// Street pictures get a lighter scrim (bottom 28%, up to 35% black) than the views from above (35%, up to 45%).
const PHOTO_SCRIM = [0, 0.12, 0.24, 0.35];
const ABOVE_SCRIM = [0, 0.14, 0.3, 0.45];
// Under the status bar: clear at 96 pt, darkest at the top edge, so the clock reads without a hard line.
const TOP_SCRIM = [0, 0.08, 0.2, 0.3];
const TOP_SCRIM_H = 96;

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
  fadeMs = 0,
  onPhoto,
  onFlyover,
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
  /** Cross-fade as a picture arrives: 200 ms, none with Reduce Motion. */
  fadeMs?: number;
  onPhoto?: (imageId: string, ok: boolean) => void;
  /** The 3D view has drawn; the gallery's chip credits Esri's still until then, so the still carries no credit of its own. */
  onFlyover?: () => void;
}) {
  const isDark = useIsDark();
  switch (page.kind) {
    case 'lookaround':
      return (
        <Image
          source={{ uri: page.uri }}
          style={StyleSheet.absoluteFill}
          contentFit={full ? 'contain' : 'cover'}
          accessibilityIgnoresInvertColors
          transition={{ duration: fadeMs, effect: 'cross-dissolve', timing: 'ease-out' }}
        />
      );
    case 'photo':
      return (
        <Image
          source={{ uri: page.url }}
          style={StyleSheet.absoluteFill}
          contentFit={full ? 'contain' : 'cover'}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          transition={{ duration: fadeMs, effect: 'cross-dissolve', timing: 'ease-out' }}
          onLoad={() => onPhoto?.(page.photo.image_id, true)}
          onError={() => onPhoto?.(page.photo.image_id, false)}
        />
      );
    case 'flyover':
      return live ? (
        <FlyoverHero
          lat={lat}
          lng={lng}
          watched={watched}
          legalTop={full ? undefined : height - bottomInset - 64}
          stillCredit={!onFlyover}
          onReady={onFlyover}
        />
      ) : null;
    case 'aerial':
      return <MapSnapshot lat={lat} lng={lng} zoom={17} watched={watched} attribution={false} style={{ height }} />;
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

/**
 * The bottom of the hero, darkening toward black, so white type reads on any picture. One native gradient:
 * stacked slices left 1 px seams where their fractional heights rounded.
 */
function Scrim({ height, steps, edge = 'bottom' }: { height: number; steps: readonly number[]; edge?: 'top' | 'bottom' }) {
  const stops = steps.map((o, i) => `rgba(0,0,0,${o}) ${Math.round((i / (steps.length - 1)) * 100)}%`).join(', ');
  const direction = edge === 'top' ? 'to top' : 'to bottom';
  return (
    <View
      pointerEvents="none"
      style={[
        styles.scrim,
        edge === 'top' ? { top: 0, bottom: undefined } : null,
        {
          height,
          backgroundImage: `linear-gradient(${direction}, ${stops})`,
        },
      ]}
    />
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
  name,
  lat,
  lng,
  kind,
  onClose,
}: {
  pages: Page[];
  start: string;
  name: string;
  lat: number;
  lng: number;
  kind: PinKind;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const width = useAppWidth();
  const insets = useSafeAreaInsets();
  const first = Math.max(
    0,
    pages.findIndex((p) => p.key === start),
  );
  const [page, setPage] = useState(first);
  const cap = pages[page] ? caption(pages[page], name) : null;

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
            <Text variant="callout" style={styles.white}>
              {cap.chip}
            </Text>
            {cap.viewer?.map((line) => (
              <Text key={line} variant="caption" style={[styles.white, styles.credit]}>
                {line}
              </Text>
            ))}
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
  // 30% black over the scrim on a picture; a plain map has no scrim, so its pill is darker to keep white type legible.
  chip: { flexShrink: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.3)' },
  mapChip: { backgroundColor: 'rgba(0,0,0,0.6)' },
  white: { color: '#FFFFFF' },
  credit: { opacity: 0.85 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Keeps the status bar readable over a bright sky.
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
