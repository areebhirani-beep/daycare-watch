import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, View } from 'react-native';

import { LastChecked } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { ActionTile, SectionHeader, StickyBar } from '@/components/ui/Chrome';
import { Disclosure } from '@/components/ui/Disclosure';
import { FindingCard } from '@/components/ui/FindingCard';
import { byWeight, visitAnswer } from '@/components/ui/PlacePage';
import { Text } from '@/components/ui/Text';
import { formatDate, formatDateShort, plural, tidyCase, todayIso } from '@/lib/format';
import { type ActivityNoun, activityNoun, type Change, whatChanged } from '@/lib/record';
import { lawCovers } from '@/lib/rights';
import type { AlertDetail, DaycareRecord, Finding } from '@/lib/types';
import { elevation, radius, riskRank, space, useColors } from '@/theme';

/**
 * What the state posted → when → what it means → what you can do. A real alert (alert/[eventId]) and the web's example
 * (alert/example) both draw this; the example passes its own replay label and has no posted date.
 */
export function AlertView({ a, record, replayLabel = 'Replay of a real state record' }: {
  a: AlertDetail;
  record: DaycareRecord | undefined;
  replayLabel?: string;
}) {
  const c = useColors();
  const change = record && a.finding ? whatChanged(record, a.finding.activity_id) : null;
  const visit = a.finding?.date ?? a.source_date;
  // The day this phone's clock saw the post, e.g. "Posted Oct 24" (the year only when it isn't this year).
  const posted = a.detected_at ? `Posted ${formatDateShort(todayIso(new Date(a.detected_at)), todayIso())}` : null;
  const when = [visit ? `${change?.visit ? ACTIVITY_LABEL[activityNoun(change.visit)] : 'Dated'} ${formatDate(visit)}` : null, posted]
    .filter(Boolean)
    .join(' · ');
  // A new finding answers like the place page: what the state found at that visit, and where the fixes stand.
  const answer = a.kind === 'new_violation' && change?.visit ? visitAnswer(change.visit, todayIso()) : null;
  // Every problem from the visit the headline counts, highest risk first; the alerted one is always among them.
  const visitFindings: Finding[] = a.finding
    ? [
        ...(change?.visit?.findings ?? []),
        ...(change?.visit?.findings.some((f) => f.non_compliance_id === a.finding!.non_compliance_id) ? [] : [a.finding]),
      ].sort(byWeight)
    : [];
  // Same rule as the place page: two or more Low / Medium Low findings fold into one row.
  const lower = visitFindings.filter((f) => riskRank[f.risk_level] <= 2);
  const fold = lower.length >= 2;
  const shown = fold ? visitFindings.filter((f) => riskRank[f.risk_level] > 2) : visitFindings;
  const onOfficial = record ? () => void WebBrowser.openBrowserAsync(record.official_url) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        {a.is_replay ? (
          <View style={[styles.replay, { backgroundColor: c.sunken }]}>
            <Text variant="footnote" tone="secondary">
              {replayLabel}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: space.xs }}>
          <Text variant="callout" tone="secondary">
            {tidyCase(a.daycare_name)}
          </Text>
          <Text variant={answer ? 'largeTitle' : 'display'} accessibilityRole="header">
            {answer?.headline ?? headline(a)}
          </Text>
          {answer?.sub ? (
            <Text variant="callout" tone="secondary">
              {answer.sub}
            </Text>
          ) : null}
          <Text variant="footnote" tone="secondary" tabular style={{ marginTop: space.xxs }}>
            {when}
          </Text>
        </View>

        {change?.visit ? <WhatChanged change={change} /> : null}

        {shown.map((f) => (
          <FindingCard key={f.non_compliance_id} finding={f} visitDate={visit} onOfficial={onOfficial} />
        ))}
        {fold ? (
          <Disclosure title={`${lower.length} less serious problems`}>
            {lower.map((f) => (
              <FindingCard key={f.non_compliance_id} finding={f} visitDate={visit} onOfficial={onOfficial} />
            ))}
          </Disclosure>
        ) : null}
        {visitFindings.length ? (
          <Text variant="callout" tone="tertiary">
            Risk levels are the state’s.
          </Text>
        ) : null}
        {meaning(a) ? (
          <Text variant={a.finding ? 'footnote' : 'callout'} tone="secondary">
            {meaning(a)}
          </Text>
        ) : null}

        <View style={{ gap: space.md }}>
          <SectionHeader title="What you can do" inset={0} />
          <View style={styles.tiles}>
            <ActionTile icon="list" label="Tour questions" onPress={() => router.push(`/daycare/${a.operation_id}/tour`)} />
            {!record || lawCovers(record.daycare.operation_type) ? (
              <ActionTile
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

// Only an inspection is a visit (lib/record activityNoun).
const ACTIVITY_LABEL: Record<ActivityNoun, string> = {
  visit: 'Visit',
  report: 'Report',
  'own report': 'Daycare’s own report',
  assessment: 'Assessment',
};

/** This visit against the one before it, in counts and dates only. */
function WhatChanged({ change }: { change: Change }) {
  const c = useColors();
  const { visit, previous, repeats } = change;
  if (!visit) return null;
  const high = visit.findings.filter((f) => f.risk_level === 'High').length;
  const lines = [
    `This ${ACTIVITY_LABEL[activityNoun(visit)].toLowerCase()}: ${plural(visit.findings.length, 'problem')} found${high > 0 ? `, ${high} serious` : ''}`,
    previous
      ? `${ACTIVITY_LABEL[activityNoun(previous)]} before, ${formatDate(previous.date)}: ${
          previous.status === 'findings'
            ? `${plural(previous.findings.length, 'problem')} found`
            : previous.status === 'pending'
              ? 'results not posted yet'
              : 'no problems cited'
        }`
      : 'Nothing earlier in the state record',
    ...repeats.slice(0, 2).map((r) => `Rule ${r.rule} was also cited ${formatDate(r.lastCited)}`),
  ];
  return (
    <View style={[styles.changed, elevation.card, { backgroundColor: c.surface }]} accessible accessibilityLabel={`What changed. ${lines.join('. ')}`}>
      <Text variant="subhead">What changed</Text>
      {lines.map((l) => (
        <Text key={l} variant="callout" tone="secondary" tabular>
          {l}
        </Text>
      ))}
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

/** What a kind of change means, for the kinds a parent can't read off the card. A finding card speaks for itself. */
function meaning(a: AlertDetail): string | null {
  switch (a.kind) {
    case 'new_violation':
      return null;
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
  tiles: { flexDirection: 'row', gap: space.sm },
  changed: { borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xxs },
});
