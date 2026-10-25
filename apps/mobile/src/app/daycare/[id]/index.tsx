import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform, View } from 'react-native';

import { Button, LastChecked } from '@/components/ui';
import { PlacePage, type RequestKind } from '@/components/ui/PlacePage';
import { PlaceSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useAreaCompare, useDaycareRecord, useIsWatching, useSetWatch } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { useAlertsOn } from '@/lib/notifications';
import { since } from '@/lib/perf';
import { shareText } from '@/lib/share';
import { appleMapsUrl, directionsAddress, googleMapsUrl } from '@/lib/maps';
import { LAW_CITE, requestText } from '@/lib/rights';
import { space, useColors } from '@/theme';

export default function DaycareRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const operationId = Number(id);
  const c = useColors();
  const record = useDaycareRecord(operationId);
  const area = useAreaCompare(operationId);
  const watching = useIsWatching(operationId);
  const setWatch = useSetWatch(operationId);
  const alertsOn = useAlertsOn();
  const ready = Boolean(record.data);
  useEffect(() => {
    if (ready) since('place record shown');
  }, [ready]);

  if (!record.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <Stack.Screen options={{ headerShown: false }} />
        {record.isError ? (
          <View style={{ padding: space.xl, paddingTop: 120, gap: space.md }}>
            <Text variant="title">We couldn’t reach the state record.</Text>
            <Button label="Try again" kind="secondary" onPress={() => void record.refetch()} />
          </View>
        ) : (
          <PlaceSkeleton />
        )}
      </View>
    );
  }

  const { daycare, official_url, last_checked_at } = record.data;
  const name = tidyCase(daycare.name);
  // Null for home daycares: no directions to a private residence.
  const destination = directionsAddress(daycare);
  const openMaps = (url: (a: string) => string) => (destination ? () => void Linking.openURL(url(destination)) : undefined);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PlacePage
        record={record.data}
        area={area.data}
        watching={watching}
        alertsOn={alertsOn}
        watchPending={setWatch.isPending}
        onWatch={() => router.push(`/daycare/${operationId}/watch`)}
        // Never unwatch on one tap: the watch sheet shows the status and has its own 'Stop watching'.
        onUnwatch={() => router.push(`/daycare/${operationId}/watch`)}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onShare={() => shareText(`${name}: Texas state inspection record`, `${name}: Texas state inspection record ${official_url}`)}
        onDirections={openMaps(Platform.OS === 'ios' ? appleMapsUrl : googleMapsUrl) ?? (() => undefined)}
        onOpenAppleMaps={openMaps(appleMapsUrl)}
        onOpenGoogleMaps={openMaps(googleMapsUrl)}
        onOfficial={() => void WebBrowser.openBrowserAsync(official_url)}
        onTour={() => router.push(`/daycare/${operationId}/tour`)}
        onRequest={(kind: RequestKind) => {
          const { subject, body } = requestText(kind, name);
          shareText(subject, body);
        }}
        lawCite={LAW_CITE}
        footer={<LastChecked fallback={last_checked_at} />}
      />
    </>
  );
}
