import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FindingRow } from '@/components/FindingRow';
import { Icon } from '@/components/Icon';
import { RecordSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, LastChecked, RowLink, Rule, Surface } from '@/components/ui';
import { SectionHead, Serif } from '@/components/ui/Serif';
import { useAlertDetail } from '@/lib/api';
import { formatCheckedAt, formatDate, RISK_EXPLAINER, tidyCase } from '@/lib/format';
import type { AlertDetail } from '@/lib/types';
import { minTap, space, useColors } from '@/theme';

/** What the state posted → when → what it means → what you can do. */
export default function AlertScreen() {
  const { eventId, operationId } = useLocalSearchParams<{ eventId: string; operationId?: string }>();
  const c = useColors();
  const alert = useAlertDetail(Number(eventId));

  // alert_detail returns null for an event this phone can't see: it no longer watches the daycare, or the event is gone.
  if (alert.isSuccess && !alert.data) {
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: c.bg }]}>
        <T variant="headline">This alert isn&rsquo;t available on this phone.</T>
        <T variant="callout" tone="secondary">
          Alerts open only for daycares this phone watches. The daycare&rsquo;s full state record is still public.
        </T>
        {operationId ? (
          <Button label="See the daycare’s record" onPress={() => router.replace(`/daycare/${operationId}`)} />
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
        <View style={[styles.replay, { borderLeftColor: c.accent }]}>
          <T variant="footnote" tone="secondary">
            Replay of a real state record{a.finding ? ` from ${formatDate(a.finding.date)}` : ''}, shown to demonstrate alerts.
          </T>
        </View>
      ) : null}

      <View style={{ gap: space.xs }}>
        <T variant="callout" tone="secondary">
          {name}
        </T>
        <Serif variant="title" accessibilityRole="header">
          {headline(a)}
        </Serif>
        <T variant="footnote" tone="secondary">
          Posted by Texas Health and Human Services · we saw it {formatCheckedAt(a.detected_at)}
        </T>
      </View>

      {a.finding ? (
        <View style={styles.section}>
          <SectionHead title="What the state posted" first />
          <FindingRow finding={a.finding} visitDate={a.finding.date} />
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHead title="What it means" first={!a.finding} />
        <T variant="callout">{meaning(a)}</T>
        {a.kind === 'new_violation' ? <RiskLevels /> : null}
      </View>

      <View style={styles.section}>
        <SectionHead title="What you can do" />
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

function RiskLevels() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.disclose}
      >
        <T variant="subhead" tone="accent">
          More about risk levels
        </T>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={12} color={c.accent} weight="semibold" />
        </View>
      </Pressable>
      {open ? (
        <T variant="callout" tone="secondary">
          {RISK_EXPLAINER}
        </T>
      ) : null}
    </View>
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
      return 'An inspector found the daycare did not meet a state rule. The state posts a finding only after the daycare has had due process.';
    case 'corrective_action':
      return a.after?.corrective_action
        ? 'Corrective action in Texas is probation. The state has put this daycare on probation to fix problems it found. The daycare can stay open, has to meet extra conditions, and gets inspected more often, for up to 12 months.'
        : 'State data no longer lists corrective action (probation) at this daycare.';
    case 'adverse_action':
      return a.after?.adverse_action
        ? 'Adverse action is the state\u2019s most serious kind of action against a daycare\u2019s permit. It can mean the permit is denied, cancelled, suspended, not renewed, or reissued with permanent limits.'
        : 'State data no longer lists adverse action at this daycare.';
    case 'permit_conditions':
      return 'A condition is a special requirement on a daycare\u2019s permit that allows or forbids something specific. It is not automatically a penalty. Ask the director what the condition is.';
    case 'closure':
      return 'State data marks this daycare as temporarily closed. Ask the director when and why it closed.';
    case 'status_change':
      return 'The state changed the permit status on this daycare\u2019s record. Read the official record for details.';
    case 'capacity_change':
      return 'Capacity is the most children the state permits the daycare to care for at one time.';
  }
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.section },
  section: { gap: space.md },
  disclose: { minHeight: minTap, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, alignSelf: 'flex-start' },
  replay: { borderLeftWidth: 3, paddingLeft: space.md, paddingVertical: space.xxs },
});
