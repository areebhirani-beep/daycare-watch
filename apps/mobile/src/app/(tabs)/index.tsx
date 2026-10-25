import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LastWeek } from '@/components/LastWeek';
import { LastChecked } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { HomeMap } from '@/components/ui/HomeMap';
import { Text } from '@/components/ui/Text';
import { useDaycaresNear, useMyWatches, usePrefetchRecords } from '@/lib/api';
import { mark, tapped } from '@/lib/perf';
import { findPosition, type Point, type Position, savedPosition } from '@/lib/location';
import { configError } from '@/lib/supabase';
import { radius, space, useColors } from '@/theme';

// Default view when location is off or slow: Frisco, in the district. Camera and query center only.
const DISTRICT_CENTER: Point = { lat: 33.1507, lng: -96.8236 };

export default function FindScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [saved] = useState(savedPosition);
  // undefined while asking; a late fix replaces 'slow' when the GPS answers after the 5 s timeout.
  const [position, setPosition] = useState<Position | undefined>(undefined);

  const locate = useCallback(
    () =>
      findPosition((late) => {
        mark(`location late ${typeof late === 'string' ? late : 'found'}`);
        setPosition(late);
      }).then((p) => {
        mark(`location ${typeof p === 'string' ? p : 'found'}`);
        setPosition(p);
      }),
    [],
  );

  useEffect(() => {
    void locate();
  }, [locate]);

  const point = typeof position === 'object' ? position : null;
  // Never wait on location: start from the last position (or the district), then re-center when it answers.
  const origin = point ?? saved;
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
  usePrefetchRecords(useMemo(() => (near.data ?? []).slice(0, 5).map((d) => d.operation_id), [near.data]));
  const watchedIds = useMemo(() => new Set(watches.data?.map((d) => d.operation_id)), [watches.data]);

  const open = (id: number) => {
    tapped('place');
    router.push(`/daycare/${id}`);
  };
  // Pull to refresh asks the state data again: the list, last week's visits, and when we last checked.
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      near.refetch(),
      queryClient.refetchQueries({ queryKey: ['district_pulse'] }),
      queryClient.refetchQueries({ queryKey: ['district_recent_visits'] }),
      queryClient.refetchQueries({ queryKey: ['last_sync'] }),
    ]).catch(() => undefined);
    setRefreshing(false);
  };

  const problem = configError ?? (near.isError ? 'We couldn’t reach the state records. Check your connection.' : null);

  return (
    <View style={{ flex: 1 }}>
      <HomeMap
        rows={near.data ?? []}
        // On an error the sheet keeps its skeleton under the error card, never "0 daycares".
        loading={problem !== null || near.isPending}
        center={outside ? null : origin}
        fallbackCenter={DISTRICT_CENTER}
        // Set only when the list isn't from this phone's own location.
        areaName={outside || (!point && !saved) ? 'Frisco' : undefined}
        areaLabel={
          outside
            ? 'No Texas daycares near you'
            : point || saved
              ? (position === 'denied' || position === 'unavailable') && !point
                ? 'Near your last location'
                : undefined
              : position === 'denied'
                ? 'Location is off'
                : position === 'unavailable'
                  ? 'Location unavailable'
                  : 'Finding your location…'
        }
        watchedIds={watchedIds}
        onOpen={open}
        feed={<LastWeek onOpen={open} onSeeAll={() => router.push('/week')} />}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        onSearch={() => router.push('/search')}
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
