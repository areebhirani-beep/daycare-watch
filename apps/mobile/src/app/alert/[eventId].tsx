import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { LastChecked } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { ActionPill, SectionHeader, StickyBar } from '@/components/ui/Chrome';
import { FindingCard } from '@/components/ui/FindingCard';
import { RecordStrip, stripFromRecord } from '@/components/ui/RecordStrip';
import { PlaceSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useAlertDetail, useDaycareRecord } from '@/lib/api';
import { formatDate, formatLocalDay, tidyCase } from '@/lib/format';
import { lawCovers } from '@/lib/rights';
import type { AlertDetail } from '@/lib/types';
import { radius, space, useColors } from '@/theme';

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

  const a = alert.data;
  const strip = record.data ? stripFromRecord(record.data) : null;
  const visit = a.finding?.date ?? a.source_date;
  const when = [visit ? `Visit ${formatDate(visit)}` : null, `posted by ${formatLocalDay(a.detected_at)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        {a.is_replay ? (
          <View style={[styles.replay, { backgroundColor: c.sunken }]}>
            <Text variant="footnote" tone="secondary">
              Replay of a real state record
            </Text>
          </View>
        ) : null}

        <View style={{ gap: space.xs }}>
          <Text variant="callout" tone="secondary">
            {tidyCase(a.daycare_name)}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {headline(a)}
          </Text>
        </View>

        {strip ? <RecordStrip visits={strip} variant="full" selectedId={a.finding?.activity_id ?? null} showKey={false} /> : null}
        <Text variant="footnote" tone="secondary" tabular>
          {when}
        </Text>

        {a.finding ? <FindingCard finding={a.finding} visitDate={a.finding.date} /> : null}
        <Text variant={a.finding ? 'footnote' : 'callout'} tone="secondary">
          {meaning(a)}
        </Text>

        <View style={{ gap: space.md }}>
          <SectionHeader title="What you can do" inset={0} />
          <View style={styles.pills}>
            <ActionPill icon="list" label="Tour questions" onPress={() => router.push(`/daycare/${a.operation_id}/tour`)} />
            {!record.data || lawCovers(record.data.daycare.operation_type) ? (
              <ActionPill
                icon="doc"
                label="Request records"
                onPress={() => router.push({ pathname: '/rights', params: { operationId: String(a.operation_id) } })}
              />
            ) : null}
          </View>
        </View>

        <LastChecked />
      </ScrollView>
      <StickyBar>
        <Button label="Open full record" kind="ink" onPress={() => router.push(`/daycare/${a.operation_id}`)} style={{ flex: 1 }} />
      </StickyBar>
    </View>
  );
}

function headline(a: AlertDetail): string {
  const after = a.after ?? {};
  switch (a.kind) {
    case 'new_violation':
      return 'New finding posted';
    case 'status_change':
      return after.status === 'inactive' || after.status === 'N' ? 'Permit listed as inactive' : 'Permit listed as active again';
    case 'corrective_action':
      return after.corrective_action ? 'Placed under corrective action' : 'Corrective action ended';
    case 'adverse_action':
      return after.adverse_action ? 'Placed under adverse action' : 'Adverse action ended';
    case 'closure':
      return after.temporarily_closed ? 'Listed as temporarily closed' : 'No longer listed as closed';
    case 'capacity_change':
      return `Capacity changed from ${String(a.before?.capacity ?? '?')} to ${String(after.capacity ?? '?')}`;
    case 'permit_conditions':
      return after.conditions_on_permit ? 'Conditions placed on the permit' : 'Permit conditions lifted';
  }
}

function meaning(a: AlertDetail): string {
  switch (a.kind) {
    case 'new_violation':
      return 'An inspector found the daycare did not meet a state rule.';
    case 'corrective_action':
      return a.after?.corrective_action
        ? 'Corrective action in Texas is probation: the daycare stays open, meets extra conditions, and is inspected more often, for up to 12 months.'
        : 'State data no longer lists corrective action (probation) at this daycare.';
    case 'adverse_action':
      return a.after?.adverse_action
        ? 'The state’s most serious action on a permit. It can mean the permit is denied, cancelled, suspended, not renewed, or reissued with permanent limits.'
        : 'State data no longer lists adverse action at this daycare.';
    case 'permit_conditions':
      return 'A condition allows or forbids something specific on the permit. It is not automatically a penalty. Ask the director what it is.';
    case 'closure':
      return 'Ask the director when and why it closed.';
    case 'status_change':
      return 'Read the official record for details.';
    case 'capacity_change':
      return 'Capacity is the most children the state permits at one time.';
  }
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.section },
  replay: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
