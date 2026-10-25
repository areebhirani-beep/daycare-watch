import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DaycareListRow } from '@/components/DaycareListRow';
import { Icon } from '@/components/Icon';
import { ListSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, LastChecked, Rule } from '@/components/ui';
import { RecordStrip, StripSkeleton, stripFromRecord } from '@/components/ui/RecordStrip';
import { SectionHead, Serif } from '@/components/ui/Serif';
import { useDaycareRecord, useDaycareSearch, useDaycaresNear, useMyWatches } from '@/lib/api';
import { operationTypeLabel, plural, tidyCase } from '@/lib/format';
import { isExpoGo } from '@/lib/runtime';
import type { DaycareRow } from '@/lib/types';
import { font, minTap, radius, space, TAB_BAR_CLEARANCE, type as typeScale, useColors } from '@/theme';

// Expo Go has no MapLibre: there, Find is the list alone. The module is required only when it can load.
const DaycareMap: typeof import('@/components/DaycareMap').DaycareMap | null = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/components/DaycareMap') as typeof import('@/components/DaycareMap')).DaycareMap;

// Default view when location is off: Rockwall, inside TX-04. Camera only, not data.
const DEFAULT_CENTER = { lat: 32.9312, lng: -96.4597 };

export default function FindScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [picked, setPicked] = useState<DaycareRow | null>(null);
  const searching = query.trim().length >= 2;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setCenter(DEFAULT_CENTER);
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })().catch(() => setCenter(DEFAULT_CENTER));
  }, []);

  const near = useDaycaresNear(center, 15);
  const search = useDaycareSearch(query);
  const watches = useMyWatches();
  const watchedIds = useMemo(() => new Set(watches.data?.map((d) => d.operation_id)), [watches.data]);

  const list = searching ? search.data : near.data;
  const loading = searching ? search.isPending : near.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={styles.top}>
        <T variant="largeTitle" accessibilityRole="header">
          Find a daycare
        </T>
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Icon name="search" size={16} color={c.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, city, or ZIP"
            placeholderTextColor={c.textTertiary}
            accessibilityLabel="Search daycares by name, city, or ZIP"
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.input, { color: c.text }]}
          />
        </View>
      </View>

      {!searching && DaycareMap ? (
        <View style={[styles.mapWrap, { borderColor: c.hairline }]}>
          <DaycareMap
            rows={near.data ?? []}
            watchedIds={watchedIds}
            center={center}
            fallbackCenter={DEFAULT_CENTER}
            onPick={setPicked}
          />
        </View>
      ) : null}

      <FlatList
        data={list ?? []}
        keyExtractor={(d) => String(d.operation_id)}
        renderItem={({ item }) => <DaycareListRow d={item} />}
        ItemSeparatorComponent={() => <Rule inset={space.xl} />}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SectionHead
              first
              title={searching ? 'Matches' : 'Near you'}
              aside={list ? plural(list.length, searching ? 'match' : 'daycare', searching ? 'matches' : 'daycares') : undefined}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <View style={styles.empty}>
              <T variant="callout" tone="secondary">
                {searching
                  ? 'No Texas daycares match that name, city, or ZIP.'
                  : 'No daycares with a mapped address within 15 km. Try searching by name or city.'}
              </T>
            </View>
          )
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: space.xl }}>
            <LastChecked />
          </View>
        }
      />
      {picked && !searching ? <PinCallout d={picked} onClose={() => setPicked(null)} /> : null}
    </View>
  );
}

/** The card a pin opens: name, place, and the daycare's own record strip. Paper, hairline, no shadow. */
function PinCallout({ d, onClose }: { d: DaycareRow; onClose: () => void }) {
  const c = useColors();
  const record = useDaycareRecord(d.operation_id);
  const name = tidyCase(d.name);
  const place = [
    operationTypeLabel(d.operation_type),
    tidyCase(d.city),
    d.distance_km != null ? `${(d.distance_km * 0.621371).toFixed(1)} mi` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View
      style={[styles.callout, { backgroundColor: c.bg, borderTopColor: c.hairline }]}
      accessibilityViewIsModal
    >
      <View style={styles.calloutHead}>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Serif variant="heading" accessibilityRole="header" numberOfLines={2}>
            {name}
          </Serif>
          <T variant="footnote" tone="secondary" numberOfLines={1}>
            {place}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
          <Icon name="close" size={14} color={c.textSecondary} weight="semibold" />
        </Pressable>
      </View>
      {record.data ? (
        <RecordStrip visits={stripFromRecord(record.data)} variant="compact" showKey={false} labels />
      ) : (
        <StripSkeleton variant="compact" />
      )}
      <Button
        label="Open the record"
        onPress={() => {
          onClose();
          router.push(`/daycare/${d.operation_id}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, gap: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: minTap,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, ...typeScale.body, fontFamily: font.regular, paddingVertical: space.sm },
  mapWrap: {
    height: 240,
    marginHorizontal: space.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  callout: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: TAB_BAR_CLEARANCE - space.xl,
    gap: space.md,
  },
  calloutHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  close: { width: minTap, height: minTap, alignItems: 'center', justifyContent: 'center', marginTop: -space.sm, marginRight: -space.md },
  listHeader: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xs },
  empty: { paddingHorizontal: space.xl, paddingVertical: space.lg },
});

