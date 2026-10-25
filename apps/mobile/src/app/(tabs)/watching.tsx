import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DaycareListRow } from '@/components/DaycareListRow';
import { ListSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, LastChecked, Rule } from '@/components/ui';
import { useMyWatches } from '@/lib/api';
import { getPermission, type PermissionState } from '@/lib/notifications';
import { space, TAB_BAR_CLEARANCE, useColors } from '@/theme';

export default function WatchingScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const watches = useMyWatches();
  const [permission, setPermission] = useState<PermissionState | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getPermission().then(setPermission);
    }, []),
  );

  const list = watches.data ?? [];
  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: TAB_BAR_CLEARANCE }}
      data={list}
      keyExtractor={(d) => String(d.operation_id)}
      renderItem={({ item }) => <DaycareListRow d={item} />}
      ItemSeparatorComponent={() => <Rule inset={space.xl} />}
      refreshControl={<RefreshControl refreshing={watches.isRefetching} onRefresh={() => void watches.refetch()} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <T variant="largeTitle" accessibilityRole="header">
            Watching
          </T>
          <T variant="callout" tone="secondary">
            Alerts when the state posts something new. Readable offline.
          </T>
          {permission === 'denied' && list.length > 0 ? (
            <View style={[styles.notice, { borderColor: c.border, backgroundColor: c.surface }]}>
              <T variant="callout">Notifications are off for this app, so alerts can&rsquo;t reach you.</T>
              <Button label="Open Settings" kind="plain" onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        watches.isPending ? (
          <ListSkeleton rows={2} />
        ) : (
          <View style={styles.empty}>
            <T variant="headline">You&rsquo;re not watching a daycare yet</T>
            <T variant="callout" tone="secondary">
              Open your child&rsquo;s daycare from Find and tap &ldquo;My kid goes here&rdquo;.
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
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, gap: space.sm },
  notice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: space.md, gap: space.xs, marginTop: space.sm },
  empty: { paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.xs },
});
