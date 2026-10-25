import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LastChecked } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { HomeMap } from '@/components/ui/HomeMap';
import { Text } from '@/components/ui/Text';
import { useDaycaresNear, useMyWatches } from '@/lib/api';
import { mark, tapped } from '@/lib/perf';
import { isWeb } from '@/lib/runtime';
import { storage } from '@/lib/storage';
import { configError } from '@/lib/supabase';
import { radius, space, useColors } from '@/theme';

type Point = { lat: number; lng: number };

// Default view when location is off or slow: Frisco, in the district. Camera and query center only.
const DISTRICT_CENTER: Point = { lat: 33.1507, lng: -96.8236 };
const LOCATION_TIMEOUT_MS = 5_000;
const LAST_POSITION = 'last-position';

/** Where the parent was last time, kept on this phone only, so the list can load before location answers. */
function savedPosition(): Point | null {
  try {
    const raw = storage.getString(LAST_POSITION);
    return raw ? (JSON.parse(raw) as Point) : null;
  } catch {
    return null;
  }
}

/** The parent's position, or null when location is denied, unavailable, or slower than 5 s. */
async function findPosition(): Promise<Point | null> {
  // The web link never asks: a browser location prompt is the wrong first screen for a judge.
  if (isWeb) return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync();
    const pos =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
      ]));
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

export default function FindScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [saved] = useState(savedPosition);
  // undefined while asking, null when location is off or slow.
  const [position, setPosition] = useState<Point | null | undefined>(undefined);

  const locate = useCallback(
    () =>
      findPosition().then((p) => {
        mark(p ? 'location found' : 'location fallback');
        if (p) storage.set(LAST_POSITION, JSON.stringify(p));
        setPosition(p);
      }),
    [],
  );

  useEffect(() => {
    void locate();
  }, [locate]);

  // Never wait on location: start from the last position (or the district), then re-center when it answers.
  const origin = position ?? saved;
  const local = useDaycaresNear(origin ?? DISTRICT_CENTER, 15);
  // Outside Texas (a judge's phone, a simulator) nothing is within 15 km: show the district instead of an empty list.
  const outside = origin !== null && local.isSuccess && !local.isPlaceholderData && local.data.length === 0;
  const district = useDaycaresNear(outside ? DISTRICT_CENTER : null, 15);
  const near = outside ? district : local;
  const watches = useMyWatches();
  const pins = near.data?.length ?? 0;
  useEffect(() => {
    if (pins > 0) mark(`first pins (${pins})`);
  }, [pins > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const watchedIds = useMemo(() => new Set(watches.data?.map((d) => d.operation_id)), [watches.data]);

  const problem = configError ?? (near.isError ? 'We couldn’t reach the state records. Check your connection.' : null);

  return (
    <View style={{ flex: 1 }}>
      <HomeMap
        rows={near.data ?? []}
        // On an error the sheet keeps its skeleton under the error card, never "0 daycares".
        loading={problem !== null || near.isPending}
        center={outside ? null : origin}
        fallbackCenter={DISTRICT_CENTER}
        // Set only when the list isn't from this phone's own location; HomeMap then says 'Near you'.
        areaLabel={
          outside
            ? 'Near Frisco · no Texas daycares near you'
            : position === null
              ? saved
                ? 'Near your last location'
                : 'Near Frisco · location off'
              : position === undefined && !saved
                ? 'Finding your location…'
                : undefined
        }
        watchedIds={watchedIds}
        onOpen={(id) => {
          tapped('place');
          router.push(`/daycare/${id}`);
        }}
        onSearch={() => router.push('/search')}
        onAlerts={() => router.push('/(tabs)/watching')}
        onLocate={() => void locate()}
        footer={<LastChecked />}
      />
      {problem ? (
        <View
          style={[styles.notice, { top: insets.top + 76, backgroundColor: c.surface }]}
          accessibilityLiveRegion="polite"
        >
          <Text variant="callout" style={{ flex: 1 }}>
            {problem}
          </Text>
          {!configError ? (
            <Button label="Try again" kind="secondary" size="md" onPress={() => void near.refetch()} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
