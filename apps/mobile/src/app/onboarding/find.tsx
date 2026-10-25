import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { SkeletonBlock } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button } from '@/components/ui';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { RecordStrip, type RowVisit, stripFromRow } from '@/components/ui/RecordStrip';
import { Serif } from '@/components/ui/Serif';
import { useDaycaresNear, useDaycareSearch, useSetWatch } from '@/lib/api';
import { formatDate, operationTypeLabel, plural, tidyCase } from '@/lib/format';
import type { DaycareRow } from '@/lib/types';
import { minTap, motion, radius, space, useColors } from '@/theme';

type Row = DaycareRow & { visits_24mo?: RowVisit[] | null };

export default function FindScreen() {
  const c = useColors();
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<Row | null>(null);
  const searching = query.trim().length >= 2;
  const search = useDaycareSearch(query);
  const near = useDaycaresNear(searching ? null : center, 10);
  const watch = useSetWatch(picked?.operation_id ?? 0);

  const rows = ((searching ? search.data : center ? near.data : undefined) ?? []).slice(0, 8) as Row[];
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
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({ pathname: '/onboarding/alerts', params: { id: String(picked.operation_id) } });
      },
    });
  };

  return (
    <OnboardingFrame
      step={2}
      skipLabel="Just looking"
      onSkip={() => router.push('/onboarding/alerts')}
      actions={
        <>
          <Button
            label={picked ? `Watch ${picked.name}` : 'Pick a daycare to watch'}
            disabled={!picked || watch.isPending}
            onPress={onWatch}
          />
          {watch.isError ? (
            <T variant="footnote" tone="secondary" align="center">
              Couldn’t reach the server. Check your connection and try again.
            </T>
          ) : null}
        </>
      }
    >
      <View style={{ gap: space.md }}>
        <Serif variant="display" accessibilityRole="header">
          Find your daycare.
        </Serif>
        <T variant="body" tone="secondary">
          Watch the one your child goes to, or one you’re touring. You can watch more later.
        </T>
      </View>

      <View style={{ gap: space.sm }}>
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Icon name="search" size={16} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={(q) => {
              setQuery(q);
              setPicked(null);
            }}
            placeholder="Name, city, or ZIP"
            placeholderTextColor={c.textTertiary}
            accessibilityLabel="Search daycares by name, city, or ZIP"
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.input, { color: c.text }]}
          />
        </View>
        {!searching ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void locate()}
            style={({ pressed }) => [styles.locate, pressed && { opacity: 0.6 }]}
          >
            <Icon name="location" size={15} color={c.accent} />
            <T variant="callout" tone="accent">
              {locating ? 'Finding daycares near you' : 'Use my location'}
            </T>
          </Pressable>
        ) : null}
      </View>

      <View>
        {loading
          ? [0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, { borderTopColor: c.hairline }]}>
                <View style={{ flex: 1, gap: space.xs }}>
                  <SkeletonBlock height={17} width="70%" />
                  <SkeletonBlock height={13} width="50%" />
                </View>
              </View>
            ))
          : rows.map((d, i) => (
              <Animated.View
                key={d.operation_id}
                entering={FadeIn.delay(i * motion.stagger * 2)
                  .duration(motion.base)
                  .reduceMotion(ReduceMotion.System)}
              >
                <PickRow d={d} selected={picked?.operation_id === d.operation_id} onPress={() => setPicked(d)} />
              </Animated.View>
            ))}
        {searching && !loading && rows.length === 0 ? (
          <T variant="callout" tone="secondary" style={{ paddingVertical: space.lg }}>
            {`No daycare in the state’s list matches “${query.trim()}”. Try the city or ZIP instead.`}
          </T>
        ) : null}
      </View>
    </OnboardingFrame>
  );
}

function PickRow({ d, selected, onPress }: { d: Row; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const visits = d.visits_24mo ? stripFromRow(d.visits_24mo) : null;
  const where = [operationTypeLabel(d.operation_type), tidyCase(d.city)].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${d.name}. ${where}`}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: c.hairline },
        selected && { backgroundColor: c.accentSoft },
        pressed && !selected && { backgroundColor: c.sunken },
      ]}
    >
      <View style={[styles.rail, { backgroundColor: selected ? c.accent : 'transparent' }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="headline">{d.name}</T>
        <T variant="footnote" tone="secondary">
          {where}
        </T>
        {d.last_inspection_date ? (
          <T variant="footnote" tone="secondary" tabular>
            {`Last state visit ${formatDate(d.last_inspection_date)} · ${plural(d.findings_24mo ?? 0, 'finding')} in 24 months`}
          </T>
        ) : null}
      </View>
      {visits ? (
        <View style={{ width: 84 }}>
          <RecordStrip visits={visits} variant="compact" />
        </View>
      ) : null}
      {selected ? <Icon name="check" size={16} color={c.accent} weight="semibold" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  input: { flex: 1, fontFamily: 'PublicSans_400Regular', fontSize: 17, paddingVertical: space.md },
  locate: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: minTap, alignSelf: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.md,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rail: { position: 'absolute', left: 0, top: space.sm, bottom: space.sm, width: 3, borderRadius: 1.5 },
});

