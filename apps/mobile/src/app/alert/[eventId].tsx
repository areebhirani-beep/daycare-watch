import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AlertView } from '@/components/ui/AlertView';
import { Button } from '@/components/ui/Button';
import { PlaceSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useAlertDetail, useDaycareRecord } from '@/lib/api';
import { space, useColors } from '@/theme';

/** What the state posted → when → what it means → what you can do. */
export default function AlertScreen() {
  const { eventId, operationId } = useLocalSearchParams<{ eventId: string; operationId?: string }>();
  const c = useColors();
  const alert = useAlertDetail(Number(eventId));
  const record = useDaycareRecord(alert.data?.operation_id ?? 0);

  // alert_detail returns null for an event this phone can't see: it no longer watches the daycare, or the event is gone.
  if (alert.isSuccess && !alert.data) {
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: c.bg }]}>
        <Text variant="title">This alert isn&rsquo;t on this phone.</Text>
        <Text variant="callout" tone="secondary">
          Alerts open only for daycares this phone watches. The state record is still public.
        </Text>
        {operationId ? (
          <Button label="See the record" kind="ink" onPress={() => router.replace(`/daycare/${operationId}`)} />
        ) : null}
        <Button label="Go to Watching" kind="secondary" onPress={() => router.replace('/watching')} />
      </View>
    );
  }

  if (!alert.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {alert.isError ? (
          <View style={styles.content}>
            <Text variant="title">We couldn&rsquo;t load this alert.</Text>
            <Button label="Try again" kind="secondary" onPress={() => void alert.refetch()} />
          </View>
        ) : (
          <PlaceSkeleton heroHeight={0} />
        )}
      </View>
    );
  }

  return <AlertView a={alert.data} record={record.data} />;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.section },
});
