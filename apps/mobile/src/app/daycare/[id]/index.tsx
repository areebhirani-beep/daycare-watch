import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform, Share, View } from 'react-native';

import { Button, LastChecked } from '@/components/ui';
import { PlacePage, type RequestKind } from '@/components/ui/PlacePage';
import { PlaceSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useAreaCompare, useDaycareRecord, useIsWatching, useSetWatch } from '@/lib/api';
import { tidyCase } from '@/lib/format';
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
  const where = daycare.lat != null && daycare.lng != null ? `${daycare.lat},${daycare.lng}` : encodeURIComponent(`${daycare.address} ${daycare.city} TX ${daycare.zip ?? ''}`);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PlacePage
        record={record.data}
        area={area.data}
        watching={watching}
        watchPending={setWatch.isPending}
        onWatch={() => router.push(`/daycare/${operationId}/watch`)}
        onUnwatch={() => setWatch.mutate(false)}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onShare={() => void Share.share({ message: `${name}: Texas state inspection record ${official_url}` })}
        onDirections={() =>
          void Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${where}` : `geo:0,0?q=${where}`)
        }
        onOfficial={() => void WebBrowser.openBrowserAsync(official_url)}
        onTour={() => router.push(`/daycare/${operationId}/tour`)}
        onRequest={(kind: RequestKind) => {
          const { subject, body } = requestText(kind, name);
          void Share.share({ title: subject, message: body }, { subject });
        }}
        lawCite={LAW_CITE}
        footer={<LastChecked fallback={last_checked_at} />}
      />
    </>
  );
}
