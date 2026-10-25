import * as Location from 'expo-location';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { FlatList, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { LoadError } from '@/components/LoadError';
import { Button } from '@/components/ui/Button';
import { ActionPill, SearchPill } from '@/components/ui/Chrome';
import { DaycareCard, PlaceRow } from '@/components/ui/DaycareCard';
import { Glyph } from '@/components/ui/Glyph';
import { rowFallback, rowMeta, rowStrip } from '@/components/ui/HomeMap';
import { markOnboarded, ONBOARDING_AREA } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { CardSkeleton, RowSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycaresNear, useDaycareSearch, useSetWatch } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { easeOut, enter, haptic, motion, space, useColors } from '@/theme';

/** The picked card rises 2 pt and gets a check, like choosing a ride in Uber. No bounce. */
function Lift({ selected, children }: { selected: boolean; children: ReactNode }) {
  const c = useColors();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(selected ? 1 : 0, { duration: motion.base, easing: easeOut, reduceMotion: ReduceMotion.System });
  }, [selected, t]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * t.value }] }));
  return (
    <Animated.View style={s}>
      {children}
      {selected ? (
        <Animated.View
          entering={FadeIn.duration(motion.fast).reduceMotion(ReduceMotion.System)}
          style={[styles.check, { backgroundColor: c.signal }]}
          accessibilityElementsHidden
        >
          <Glyph name="check" size={18} color={c.onSignal} weight="heavy" />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Step 3: find yours. Opens already full: the licensed centers nearest Frisco (or the parent, once
 * they share a location) as photo cards. Search switches to the dense list. Picking one lifts it.
 * The pre-filled cards are centers only: home daycares appear when a parent searches for one.
 */
export default function FindScreen() {
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<DaycareRow | null>(null);
  const searching = query.trim().length >= 2;
  const search = useDaycareSearch(query);
  const near = useDaycaresNear(searching ? null : (center ?? ONBOARDING_AREA), 10);
  const watch = useSetWatch(picked?.operation_id ?? 0);

  const nearby = (near.data ?? []).filter((r) => r.operation_type === 'Licensed Center').slice(0, 8);
  const results = (search.data ?? []).slice(0, 8);
  const cardW = Math.round(width * 0.76);

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setQuery('');
      setPicked(null);
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setLocating(false);
    }
  };

  // The web link is read-only (no sign-in, no alerts): a pick opens the record straight away.
  const web = Platform.OS === 'web';
  const onWatch = () => {
    if (!picked) return;
    if (web) {
      markOnboarded();
      router.replace(`/daycare/${picked.operation_id}`);
      return;
    }
    watch.mutate(true, {
      onSuccess: () => router.push({ pathname: '/onboarding/alerts', params: { id: String(picked.operation_id) } }),
    });
  };

  return (
    <OnboardingFrame
      step={3}
      actions={
        <>
          <Button
            label={picked ? (web ? 'See the state record' : 'Watch this daycare') : 'Pick your daycare'}
            kind="ink"
            icon={picked && !web ? 'bell' : undefined}
            disabled={!picked || watch.isPending}
            onPress={onWatch}
          />
          {watch.isError ? (
            <Text variant="footnote" tone="secondary" align="center">
              Couldn’t reach the server. Try again.
            </Text>
          ) : (
            <Button
              label="I’m just looking"
              kind="plain"
              size="md"
              onPress={() => {
                if (!web) return router.push('/onboarding/alerts');
                markOnboarded();
                router.replace('/');
              }}
            />
          )}
        </>
      }
    >
      <Text variant="display" accessibilityRole="header">
        Find your daycare.
      </Text>

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

      {searching ? (
        <View style={{ marginHorizontal: -space.xl }}>
          {search.isPending
            ? [0, 1, 2].map((i) => <RowSkeleton key={i} />)
            : results.map((d, i) => (
                <Animated.View key={d.operation_id} entering={enter(i)}>
                  <PlaceRow
                    name={tidyCase(d.name)}
                    meta={rowMeta(d)}
                    lat={d.lat}
                    lng={d.lng}
                    operationType={d.operation_type}
                    strip={rowStrip(d)}
                    fallback={rowFallback(d)}
                    selected={picked?.operation_id === d.operation_id}
                    onPress={() => setPicked(d)}
                  />
                </Animated.View>
              ))}
          {search.isError ? (
            <LoadError style={{ padding: space.xl }} onRetry={() => void search.refetch()} />
          ) : !search.isPending && results.length === 0 ? (
            <Text variant="callout" tone="secondary" style={{ padding: space.xl }}>
              {`No daycare in the state’s list matches “${query.trim()}”. Try the city or ZIP.`}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <View style={styles.head}>
            <Text variant="headline" style={{ flexGrow: 1 }}>
              {center ? 'Centers near you' : `Centers ${ONBOARDING_AREA.label.replace(/^Near/, 'near')}`}
            </Text>
            {center ? null : (
              <ActionPill icon="locate" label={locating ? 'Finding you…' : 'Use my location'} onPress={() => void locate()} />
            )}
          </View>
          {near.isError ? (
            <LoadError onRetry={() => void near.refetch()} />
          ) : (
            <FlatList
              horizontal
              data={near.isPending ? [] : nearby}
              keyExtractor={(d) => String(d.operation_id)}
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardW + space.md}
              decelerationRate="fast"
              style={{ marginHorizontal: -space.xl, overflow: 'visible' }}
              contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md }}
              ListEmptyComponent={
                near.isPending ? (
                  <View style={{ flexDirection: 'row', gap: space.md }}>
                    <CardSkeleton width={cardW} heroRatio={1.2} />
                    <CardSkeleton width={cardW} heroRatio={1.2} />
                  </View>
                ) : (
                  <Text variant="callout" tone="secondary">
                    No licensed centers on the state’s list near here. Try searching.
                  </Text>
                )
              }
              renderItem={({ item: d, index }) => (
                <Animated.View entering={enter(index)}>
                  <Lift selected={picked?.operation_id === d.operation_id}>
                    <DaycareCard
                      width={cardW}
                      heroRatio={1.2}
                      name={tidyCase(d.name)}
                      meta={rowMeta(d)}
                      lat={d.lat}
                      lng={d.lng}
                      operationType={d.operation_type}
                      strip={rowStrip(d)}
                      fallback={rowFallback(d)}
                      onPress={() => {
                        haptic.select();
                        setPicked(picked?.operation_id === d.operation_id ? null : d);
                      }}
                    />
                  </Lift>
                </Animated.View>
              )}
            />
          )}
        </View>
      )}
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  check: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
