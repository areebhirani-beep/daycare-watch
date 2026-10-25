import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { ActionPill, SearchPill } from '@/components/ui/Chrome';
import { PlaceRow } from '@/components/ui/DaycareCard';
import { rowFallback, rowMeta, rowStrip } from '@/components/ui/HomeMap';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { RowSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycaresNear, useDaycareSearch, useSetWatch } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { motion, space } from '@/theme';

export default function FindScreen() {
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<DaycareRow | null>(null);
  const searching = query.trim().length >= 2;
  const search = useDaycareSearch(query);
  const near = useDaycaresNear(searching ? null : center, 10);
  const watch = useSetWatch(picked?.operation_id ?? 0);

  const rows = ((searching ? search.data : center ? near.data : undefined) ?? []).slice(0, 8);
  const loading = searching ? search.isPending : center !== null && near.isPending;

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setQuery('');
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setLocating(false);
    }
  };

  const onWatch = () => {
    if (!picked) return;
    watch.mutate(true, {
      onSuccess: () => router.push({ pathname: '/onboarding/alerts', params: { id: String(picked.operation_id) } }),
    });
  };

  return (
    <OnboardingFrame
      step={2}
      onClose={() => router.push('/onboarding/alerts')}
      actions={
        <>
          <Button
            label={picked ? 'Watch this daycare' : 'Pick your daycare'}
            kind="ink"
            icon={picked ? 'bell' : undefined}
            disabled={!picked || watch.isPending}
            onPress={onWatch}
          />
          {watch.isError ? (
            <Text variant="footnote" tone="secondary" align="center">
              Couldn’t reach the server. Try again.
            </Text>
          ) : (
            <Button label="I’m just looking" kind="plain" size="md" onPress={() => router.push('/onboarding/alerts')} />
          )}
        </>
      }
    >
      <Text variant="display" accessibilityRole="header">
        Find your daycare.
      </Text>

      <View style={{ gap: space.md }}>
        <SearchPill
          floating={false}
          placeholder="Name, city, or ZIP"
          input={{
            value: query,
            onChangeText: (q) => {
              setQuery(q);
              setPicked(null);
            },
            accessibilityLabel: 'Search daycares by name, city, or ZIP',
          }}
        />
        {!searching ? (
          <View style={{ flexDirection: 'row' }}>
            <ActionPill icon="locate" label={locating ? 'Finding daycares near you…' : 'Use my location'} onPress={() => void locate()} />
          </View>
        ) : null}
      </View>

      <View style={{ marginHorizontal: -space.xl }}>
        {loading
          ? [0, 1, 2].map((i) => <RowSkeleton key={i} />)
          : rows.map((d, i) => (
              <Animated.View
                key={d.operation_id}
                entering={FadeIn.delay(i * motion.stagger)
                  .duration(motion.base)
                  .reduceMotion(ReduceMotion.System)}
              >
                <PlaceRow
                  name={tidyCase(d.name)}
                  meta={rowMeta(d)}
                  lat={d.lat}
                  lng={d.lng}
                  strip={rowStrip(d)}
                  fallback={rowFallback(d)}
                  selected={picked?.operation_id === d.operation_id}
                  onPress={() => setPicked(d)}
                />
              </Animated.View>
            ))}
        {searching && !loading && rows.length === 0 ? (
          <Text variant="callout" tone="secondary" style={{ padding: space.xl }}>
            {`No daycare in the state’s list matches “${query.trim()}”. Try the city or ZIP.`}
          </Text>
        ) : null}
      </View>
    </OnboardingFrame>
  );
}
