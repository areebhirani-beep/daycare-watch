import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LastChecked } from '@/components/ui';
import { HomeMap } from '@/components/ui/HomeMap';
import { useDaycaresNear, useMyWatches } from '@/lib/api';

// Default view when location is off: Rockwall, inside TX-04. Camera only, not data.
const DEFAULT_CENTER = { lat: 32.9312, lng: -96.4597 };

/** The parent's position, or Rockwall when location is off or unavailable. */
async function findCenter(): Promise<{ lat: number; lng: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return DEFAULT_CENTER;
    const last = await Location.getLastKnownPositionAsync();
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return DEFAULT_CENTER;
  }
}

export default function FindScreen() {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  const locate = useCallback(() => findCenter().then(setCenter), []);

  useEffect(() => {
    void findCenter().then(setCenter);
  }, []);

  const near = useDaycaresNear(center, 15);
  const watches = useMyWatches();
  const watchedIds = useMemo(() => new Set(watches.data?.map((d) => d.operation_id)), [watches.data]);

  return (
    <HomeMap
      rows={near.data ?? []}
      loading={near.isPending}
      center={center}
      fallbackCenter={DEFAULT_CENTER}
      watchedIds={watchedIds}
      onOpen={(id) => router.push(`/daycare/${id}`)}
      onSearch={() => router.push('/search')}
      onAlerts={() => router.push('/(tabs)/watching')}
      onLocate={() => void locate()}
      footer={<LastChecked />}
    />
  );
}
