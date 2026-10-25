import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchPill } from '@/components/ui/Chrome';
import { PlaceRow } from '@/components/ui/DaycareCard';
import { rowFallback, rowMeta, rowStrip } from '@/components/ui/HomeMap';
import { RowSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycareSearch, useMyWatches } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { space, useColors } from '@/theme';

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
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <SearchPill floating={false} input={{ value: q, onChangeText: setQ, autoFocus: true }} />
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
          ) : typed && search.isSuccess ? (
            <Text variant="callout" tone="secondary" style={{ padding: space.lg }}>
              No Texas daycares match “{q.trim()}”.
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}
