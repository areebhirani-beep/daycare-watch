import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchPill } from '@/components/ui/Chrome';
import { LoadError } from '@/components/LoadError';
import { PlaceRow } from '@/components/ui/DaycareCard';
import { rowFallback, rowMeta, rowStrip } from '@/components/ui/HomeMap';
import { RowSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycareSearch, useMyWatches } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { minTap, space, useColors } from '@/theme';

export default function SearchScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const search = useDaycareSearch(q);
  const watches = useMyWatches();
  const watchedIds = useMemo(() => new Set(watches.data?.map((d) => d.operation_id)), [watches.data]);
  const typed = q.trim().length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.sm }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <SearchPill floating={false} input={{ value: q, onChangeText: setQ, autoFocus: true }} />
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          style={{ minHeight: minTap, justifyContent: 'center' }}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Text variant="headline">Cancel</Text>
        </Pressable>
      </View>
      <FlatList
        data={typed ? (search.data ?? []) : []}
        keyExtractor={(d) => String(d.operation_id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
        renderItem={({ item }) => (
          <PlaceRow
            name={tidyCase(item.name)}
            operationType={item.operation_type}
            meta={rowMeta(item)}
            lat={item.lat}
            lng={item.lng}
            watched={watchedIds.has(item.operation_id)}
            strip={rowStrip(item)}
            fallback={rowFallback(item)}
            onPress={() => router.push(`/daycare/${item.operation_id}`)}
          />
        )}
        ListEmptyComponent={
          typed && search.isPending ? (
            <View>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : typed && search.isError ? (
            <LoadError onRetry={() => void search.refetch()} />
          ) : typed && search.isSuccess ? (
            <Text variant="callout" tone="secondary" style={{ padding: space.lg }}>
              No Texas daycares match “{q.trim()}”. Check the spelling, or try the city or ZIP.
            </Text>
          ) : !typed ? (
            <Text variant="callout" tone="secondary" style={{ padding: space.lg }}>
              Search every Texas daycare in the state&rsquo;s list by name, city, or ZIP.
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}
