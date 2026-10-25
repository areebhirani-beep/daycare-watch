import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LastChecked } from '@/components/ui';
import { LoadError } from '@/components/LoadError';
import { Button } from '@/components/ui/Button';
import { DaycareCard, PlaceRow } from '@/components/ui/DaycareCard';
import { Glyph } from '@/components/ui/Glyph';
import { rowFallback, rowMeta, rowStrip } from '@/components/ui/HomeMap';
import { RowSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { startOver, useMyWatches, usePrefetchRecords } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { enableAlerts, getPermission, type PermissionState, useAlertsOn } from '@/lib/notifications';
import { isWeb } from '@/lib/runtime';
import { radius, space, TAB_BAR_CLEARANCE, useColors } from '@/theme';

function confirmStartOver() {
  Alert.alert('Start over?', 'Stops every watch on this phone and shows setup again.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Start over',
      style: 'destructive',
      onPress: () => void startOver().then(() => router.replace('/onboarding')),
    },
  ]);
}

export default function WatchingScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const watches = useMyWatches();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  // Only promise an alert when one can arrive: permission granted and this phone registered.
  const alertsOn = useAlertsOn();
  // Spin only for a pull, not for background refetches on focus.
  const [pulling, setPulling] = useState(false);
  const queryClient = useQueryClient();
  const [turning, setTurning] = useState(false);
  // Set when the OS allowed alerts but this phone couldn't be registered, so the button doesn't just do nothing.
  const [unregistered, setUnregistered] = useState(false);
  const turnOn = async () => {
    setTurning(true);
    try {
      const r = await enableAlerts();
      setPermission(r.permission);
      setUnregistered(r.permission === 'granted' && !r.registered);
      await queryClient.invalidateQueries({ queryKey: ['alerts-on'] });
    } finally {
      setTurning(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void getPermission().then(setPermission);
    }, []),
  );

  const list = watches.data ?? [];
  // Watched records load in the background and persist, so they open offline.
  usePrefetchRecords(list.map((d) => d.operation_id));
  // One to three watched daycares read as pictures; a longer list goes back to compact rows.
  const cards = list.length <= 3;
  return (
    <FlatList
      style={{ backgroundColor: c.bg, marginTop: insets.top }}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + space.lg, flexGrow: 1 }}
      data={list}
      keyExtractor={(d) => String(d.operation_id)}
      renderItem={({ item }) =>
        cards ? (
          <View style={styles.card}>
            <DaycareCard
              width="100%"
              name={tidyCase(item.name)}
              meta={rowMeta(item)}
              lat={item.lat}
              lng={item.lng}
              operationType={item.operation_type}
              watched
              strip={rowStrip(item)}
              fallback={rowFallback(item)}
              onPress={() => router.push(`/daycare/${item.operation_id}`)}
            />
          </View>
        ) : (
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
        )
      }
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
            {/* Long-press: start over for the next parent in a test session. */}
            <Text variant="largeTitle" accessibilityRole="header" suppressHighlighting onLongPress={confirmStartOver}>
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
        // The web never signs in, so it has no watches to load (useMyWatches is off there): say where alerts live.
        !isWeb && watches.isPending ? (
          <View style={{ paddingTop: space.xl }}>
            <RowSkeleton />
            <RowSkeleton />
          </View>
        ) : !isWeb && watches.isError ? (
          <LoadError style={{ paddingTop: space.xl }} onRetry={() => void watches.refetch()} />
        ) : (
          <View style={styles.empty}>
            <View style={[styles.disc, { backgroundColor: c.signal }]}>
              <Glyph name="bellFill" size={28} color={c.onSignal} />
            </View>
            <Text variant="title" align="center" accessibilityRole="header">
              {isWeb ? 'Watching works in the iPhone app' : 'Watch a daycare'}
            </Text>
            <Text variant="callout" tone="secondary" align="center">
              {isWeb
                ? 'On the web, open any daycare to see its record.'
                : 'You get an alert when the state posts something new about it.'}
            </Text>
            <Button
              label="Find a daycare"
              kind="ink"
              onPress={() => router.navigate('/')}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        )
      }
      ListFooterComponent={
        list.length > 0 ? (
          <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
            <Text variant="callout" tone="secondary">
              {alertsOn
                ? 'You’ll get an alert when the state posts something new about a daycare you watch.'
                : 'New state records show here. Alerts aren’t on for this phone yet.'}
            </Text>
            {/* Denied is handled at the top (Open Settings); otherwise one tap asks, then registers this phone. */}
            {!alertsOn && !isWeb && permission !== 'denied' ? (
              <>
                <Button label="Turn on alerts" kind="primary" icon="bellFill" disabled={turning} onPress={() => void turnOn()} />
                {unregistered ? (
                  <Text variant="footnote" tone="secondary">
                    This phone couldn’t be set up for alerts. Try again later.
                  </Text>
                ) : null}
              </>
            ) : null}
            <LastChecked />
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  notice: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
});
