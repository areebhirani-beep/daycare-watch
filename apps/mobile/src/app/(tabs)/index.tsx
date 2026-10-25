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
import { configError } from '@/lib/supabase';
import { radius, space, useColors } from '@/theme';

type Point = { lat: number; lng: number };

// Default view when location is off or slow: Frisco, in the district. Camera and query center only.
const DISTRICT_CENTER: Point = { lat: 33.1507, lng: -96.8236 };
const LOCATION_TIMEOUT_MS = 5_000;

/** The parent's position, or null when location is denied, unavailable, or slower than 5 s. */
async function findPosition(): Promise<Point | null> {
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
  // undefined while asking, null when we fell back to the district center.
  const [position, setPosition] = useState<Point | null | undefined>(undefined);

  const locate = useCallback(() => findPosition().then(setPosition), []);

  useEffect(() => {
    void findPosition().then(setPosition);
  }, []);

  const near = useDaycaresNear(position === undefined ? null : (position ?? DISTRICT_CENTER), 15);
  const watches = useMyWatches();
  const watchedIds = useMemo(() => new Set(watches.data?.map((d) => d.operation_id)), [watches.data]);

  const problem = configError ?? (near.isError ? 'We couldn’t reach the state records. Check your connection.' : null);

  return (
    <View style={{ flex: 1 }}>
      <HomeMap
        rows={near.data ?? []}
        loading={!problem && (position === undefined || near.isPending)}
        center={position ?? null}
        fallbackCenter={DISTRICT_CENTER}
        areaLabel={position === null ? 'Near Frisco · location off' : 'Finding your location…'}
        watchedIds={watchedIds}
        onOpen={(id) => router.push(`/daycare/${id}`)}
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
