import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FindingRow } from '@/components/FindingRow';
import { RecordSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, LastChecked, RowLink, Rule, SectionLabel, Surface } from '@/components/ui';
import { useAlertDetail } from '@/lib/api';
import { formatCheckedAt, formatDate, RISK_EXPLAINER, tidyCase } from '@/lib/format';
import type { AlertDetail } from '@/lib/types';
import { space, useColors } from '@/theme';

/** What the state posted → when → what it means → what you can do. */
export default function AlertScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const c = useColors();
  const alert = useAlertDetail(Number(eventId));

  if (!alert.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {alert.isError ? (
          <View style={styles.content}>
            <T variant="headline">We couldn&rsquo;t load this alert.</T>
            <Button label="Try again" kind="secondary" onPress={() => void alert.refetch()} />
          </View>
        ) : (
          <RecordSkeleton />
        )}
      </View>
    );
  }

  const a = alert.data;
  const name = tidyCase(a.daycare_name);
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      {a.is_replay ? (
        <View style={[styles.replay, { borderColor: c.border }]}>
          <T variant="footnote" tone="secondary">
            Replay of a real state record{a.finding ? ` from ${formatDate(a.finding.date)}` : ''}. Shown to demonstrate alerts.
          </T>
        </View>
      ) : null}

      <View style={{ gap: space.xs }}>
        <T variant="callout" tone="secondary">
          {name}
        </T>
        <T variant="title" accessibilityRole="header">
          {headline(a)}
        </T>
        <T variant="footnote" tone="secondary">
          Posted by Texas Health and Human Services · we saw it {formatCheckedAt(a.detected_at)}
        </T>
      </View>

      {a.finding ? (
        <View style={styles.section}>
          <SectionLabel>What the state posted</SectionLabel>
          <FindingRow finding={a.finding} defaultOpen />
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionLabel>What it means</SectionLabel>
        <T variant="callout">{meaning(a)}</T>
      </View>

      <View style={styles.section}>
        <SectionLabel>What you can do</SectionLabel>
        <Surface>
          <RowLink
            title="Ask the director about it"
            detail="Questions built from this daycare's record"
            onPress={() => router.push(`/daycare/${a.operation_id}/tour`)}
          />
          <Rule inset={space.xl} />
          <RowLink
            title="Request records or video"
            detail="Your rights under Texas law"
            onPress={() => router.push({ pathname: '/rights', params: { operationId: String(a.operation_id) } })}
          />
          <Rule inset={space.xl} />
          <RowLink
            title="See the full record"
            detail={name}
            onPress={() => router.push(`/daycare/${a.operation_id}`)}
          />
          <Rule inset={space.xl} />
          <RowLink title="Report a concern to the state" onPress={() => router.push('/report')} />
        </Surface>
      </View>

      <LastChecked />
    </ScrollView>
  );
}

function headline(a: AlertDetail): string {
  const after = a.after ?? {};
  switch (a.kind) {
    case 'new_violation':
      return a.finding
        ? `The state posted a finding from a visit on ${formatDate(a.finding.date)}`
        : 'The state posted a new finding';
    case 'status_change':
      return after.status === 'inactive' || after.status === 'N'
        ? 'The state now lists this daycare’s permit as inactive'
        : 'The state lists this daycare’s permit as active again';
    case 'corrective_action':
      return after.corrective_action ? 'The state placed this daycare under corrective action' : 'The state lists corrective action as ended';
    case 'adverse_action':
      return after.adverse_action ? 'The state placed this daycare under adverse action' : 'The state lists adverse action as ended';
    case 'closure':
      return after.temporarily_closed ? 'The state lists this daycare as temporarily closed' : 'The state no longer lists this daycare as temporarily closed';
    case 'capacity_change':
      return `The state changed licensed capacity from ${String(a.before?.capacity ?? '?')} to ${String(after.capacity ?? '?')}`;
    case 'permit_conditions':
      return after.conditions_on_permit ? 'The state placed conditions on this daycare’s permit' : 'The state lifted conditions on this daycare’s permit';
  }
}

function meaning(a: AlertDetail): string {
  switch (a.kind) {
    case 'new_violation':
      return `An inspector found the daycare did not meet a state rule. ${RISK_EXPLAINER} The state posts a finding only after the daycare has had due process.`;
    case 'corrective_action':
      return 'The state lists a corrective action on this daycare\u2019s record. Ask the director what the state required, and read the official record for details.';
    case 'adverse_action':
      return 'The state lists an adverse action on this daycare\u2019s record. Ask the director what the state decided, and read the official record for details.';
    case 'permit_conditions':
      return 'The state lists conditions on this daycare\u2019s permit. Ask the director what they are, and read the official record for details.';
    case 'closure':
      return 'The state lists this daycare as temporarily closed. Ask the director when and why it closed.';
    case 'status_change':
      return 'The state changed the permit status on this daycare\u2019s record. Read the official record for details.';
    case 'capacity_change':
      return 'Capacity is the most children the state permits the daycare to care for at one time.';
  }
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.section },
  section: { gap: space.sm, paddingTop: space.md },
  replay: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: space.md },
});
