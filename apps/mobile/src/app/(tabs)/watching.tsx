import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, LastChecked, RowLink, Rule } from '@/components/ui';
import { RecordStrip, StripSkeleton, stripFromRecord } from '@/components/ui/RecordStrip';
import { useDaycareRecord, useMyWatches } from '@/lib/api';
import { formatDate, plural, tidyCase } from '@/lib/format';
import { groupByVisit } from '@/lib/record';
import type { DaycareRecord, DaycareRow } from '@/lib/types';
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
      style={{ backgroundColor: c.bg, marginTop: insets.top }}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      data={list}
      keyExtractor={(d) => String(d.operation_id)}
      renderItem={({ item }) => <WatchedRow d={item} />}
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
        <View>
          {list.length > 0 ? (
            <>
              <Rule inset={space.xl} />
              <RowLink title="Watch another daycare" onPress={() => router.navigate('/')} />
            </>
          ) : null}
          <View style={{ paddingHorizontal: space.xl }}>
            <LastChecked />
          </View>
        </View>
      }
    />
  );
}

/** One watched daycare: name, its own record strip from the cached record, and the latest visit in words. */
function WatchedRow({ d }: { d: DaycareRow }) {
  const c = useColors();
  const record = useDaycareRecord(d.operation_id);
  const name = tidyCase(d.name);
  const latest = record.data ? latestLine(record.data) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, latest].filter(Boolean).join('. ')}
      accessibilityHint="Opens the state record"
      onPress={() => router.push(`/daycare/${d.operation_id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.sunken }]}
    >
      <T variant="headline" numberOfLines={2}>
        {name}
      </T>
      {record.data ? (
        <RecordStrip visits={stripFromRecord(record.data)} variant="compact" showKey={false} labels />
      ) : (
        <StripSkeleton variant="compact" />
      )}
      {latest ? (
        <T variant="footnote" tone="secondary" tabular>
          {latest}
        </T>
      ) : null}
    </Pressable>
  );
}

function latestLine(record: DaycareRecord): string | null {
  const visit = groupByVisit(record)
    .filter((v) => v.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!visit) return 'No state visits posted';
  const when = formatDate(visit.date);
  if (visit.status === 'findings') return `Latest: ${plural(visit.findings.length, 'finding')} posted from the ${when} visit`;
  if (visit.status === 'pending') return `Latest: visit ${when}, findings not posted yet`;
  return `Latest: visit ${when}, no findings posted`;
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.sm },
  header: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, gap: space.sm },
  notice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: space.md, gap: space.xs, marginTop: space.sm },
  empty: { paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.xs },
});
