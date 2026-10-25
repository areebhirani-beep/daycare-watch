import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LastChecked } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { PlaceRow } from '@/components/ui/DaycareCard';
import { Glyph } from '@/components/ui/Glyph';
import { rowFallback, rowMeta, rowStrip } from '@/components/ui/HomeMap';
import { RowSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useMyWatches } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { getPermission, type PermissionState } from '@/lib/notifications';
import { radius, space, TAB_BAR_CLEARANCE, useColors } from '@/theme';

export default function WatchingScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const watches = useMyWatches();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  // Spin only for a pull, not for background refetches on focus.
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getPermission().then(setPermission);
    }, []),
  );

  const list = watches.data ?? [];
  return (
    <FlatList
      style={{ backgroundColor: c.bg, marginTop: insets.top }}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE, flexGrow: 1 }}
      data={list}
      keyExtractor={(d) => String(d.operation_id)}
      renderItem={({ item }) => (
        <PlaceRow
          name={tidyCase(item.name)}
          operationType={item.operation_type}
          meta={rowMeta(item)}
          lat={item.lat}
          lng={item.lng}
          watched
          strip={rowStrip(item)}
          fallback={rowFallback(item)}
          onPress={() => router.push(`/daycare/${item.operation_id}`)}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => {
            setPulling(true);
            void watches.refetch().finally(() => setPulling(false));
          }}
        />
      }
      ListHeaderComponent={
        list.length > 0 ? (
          <View style={styles.header}>
            <Text variant="largeTitle" accessibilityRole="header">
              Watching
            </Text>
            {permission === 'denied' ? (
              <View style={[styles.notice, { backgroundColor: c.sunken }]}>
                <Text variant="callout">Notifications are off, so alerts can&rsquo;t reach you.</Text>
                <Button label="Open Settings" kind="secondary" size="md" onPress={() => void Linking.openSettings()} />
              </View>
            ) : null}
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        watches.isPending ? (
          <View style={{ paddingTop: space.xl }}>
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={[styles.disc, { backgroundColor: c.signal }]}>
              <Glyph name="bellFill" size={28} color={c.onSignal} />
            </View>
            <Text variant="title" align="center" accessibilityRole="header">
              Watch a daycare
            </Text>
            <Text variant="callout" tone="secondary" align="center">
              You get an alert when the state posts something new about it.
            </Text>
            <Button label="Find a daycare" kind="ink" onPress={() => router.navigate('/')} style={{ alignSelf: 'stretch' }} />
          </View>
        )
      }
      ListFooterComponent={
        list.length > 0 ? (
          <View style={{ paddingHorizontal: space.lg }}>
            <LastChecked />
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  notice: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xl, gap: space.md },
  disc: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
});
