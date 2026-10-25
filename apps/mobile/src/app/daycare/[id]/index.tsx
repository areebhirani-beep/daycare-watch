import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Fragment, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';

import { FindingRow } from '@/components/FindingRow';
import { Icon } from '@/components/Icon';
import { RecordSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, LastChecked, RowLink, Rule, Surface } from '@/components/ui';
import { RecordStrip, stripFromRecord, type StripVisit } from '@/components/ui/RecordStrip';
import { SectionHead, Serif } from '@/components/ui/Serif';
import { useAreaCompare, useDaycareRecord, useIsWatching, useSetWatch } from '@/lib/api';
import {
  agesLabel,
  daysLabel,
  formatDate,
  hoursLabel,
  operationTypeLabel,
  plural,
  tidyCase,
} from '@/lib/format';
import { groupByVisit, segments, summarize, type Visit, visibleVisits, visitTypeLabel } from '@/lib/record';
import type { AreaCompare, DaycareHeader } from '@/lib/types';
import { minTap, space, useColors } from '@/theme';

export default function DaycareRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const operationId = Number(id);
  const c = useColors();
  const record = useDaycareRecord(operationId);
  const area = useAreaCompare(operationId);
  const watching = useIsWatching(operationId);
  const setWatch = useSetWatch(operationId);
  const scroll = useRef<ScrollViewInstance>(null);
  // Where each visit sits in the scroll content, so a tap on the strip can bring it into view.
  const timelineY = useRef(0);
  const visitY = useRef(new Map<StripVisit['id'], number>());
  const [selected, setSelected] = useState<StripVisit['id'] | null>(null);

  function showVisit(id: StripVisit['id']) {
    setSelected(id);
    const y = visitY.current.get(id) ?? 0;
    scroll.current?.scrollTo({ y: Math.max(0, timelineY.current + y - space.md), animated: true });
  }

  if (!record.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: '' }} />
        {record.isError ? (
          <View style={styles.pad}>
            <T variant="headline">We couldn&rsquo;t reach the state record.</T>
            <T variant="callout" tone="secondary">
              Check your connection and pull to try again.
            </T>
            <Button label="Try again" kind="secondary" onPress={() => void record.refetch()} />
          </View>
        ) : (
          <RecordSkeleton />
        )}
      </View>
    );
  }

  const { daycare, official_url, last_checked_at } = record.data;
  const name = tidyCase(daycare.name);
  const summary = summarize(record.data);
  const { shown, hiddenQuiet } = visibleVisits(groupByVisit(record.data));

  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={record.isRefetching} onRefresh={() => void record.refetch()} />
      }
    >
      <Stack.Screen options={{ title: '' }} />

      {/* Header */}
      <View style={styles.header}>
        <Serif variant="display" accessibilityRole="header">
          {name}
        </Serif>
        <T variant="callout" tone="secondary">
          {[operationTypeLabel(daycare.operation_type), tidyCase(daycare.city)].filter(Boolean).join(' · ')}
        </T>
        <StatusNotes daycare={daycare} />
        <View style={styles.actions}>
          {watching ? (
            <View style={styles.watchingRow}>
              <Icon name="bellFill" size={16} color={c.accent} />
              <T variant="callout" style={{ flex: 1 }}>
                Watching · you&rsquo;ll get alerts
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop watching this daycare"
                disabled={setWatch.isPending}
                onPress={() => setWatch.mutate(false)}
                hitSlop={8}
                style={styles.stop}
              >
                <T variant="callout" tone="accent">
                  Stop
                </T>
              </Pressable>
            </View>
          ) : (
            <Button
              label="My kid goes here"
              icon="bell"
              accessibilityHint="Get an alert when the state posts something new about this daycare"
              onPress={() => router.push(`/daycare/${operationId}/watch`)}
            />
          )}
        </View>
      </View>

      {/* Summary: counts and dates only */}
      <View style={styles.section}>
        <SectionHead title={`The record, last ${summary.months} months`} first />
        <RecordStrip
          visits={stripFromRecord(record.data)}
          months={summary.months}
          onPressVisit={showVisit}
          selectedId={selected}
        />
        <View style={styles.counts}>
          {(
            [
              [summary.visits, summary.visits === 1 ? 'state visit in total' : 'state visits in total'],
              [summary.high, summary.high === 1 ? 'finding on a High risk rule' : 'findings on High risk rules'],
              [summary.notFixed, 'not yet verified by the state'],
              [summary.repeatedRules, summary.repeatedRules === 1 ? 'rule cited more than once' : 'rules cited more than once'],
            ] as const
          )
            .filter(([n], i) => i === 0 || n > 0)
            .map(([n, label]) => (
              <View key={label} style={styles.countRow} accessible accessibilityLabel={`${n} ${label}`}>
                <T variant="headline" tabular style={styles.countN}>
                  {n}
                </T>
                <T variant="callout" tone="secondary" style={{ flex: 1 }}>
                  {label}
                </T>
              </View>
            ))}
        </View>
        {summary.lastVisit ? (
          <T variant="callout" tone="secondary">
            Last state visit {formatDate(summary.lastVisit)}
          </T>
        ) : null}
      </View>

      {area.data ? <AreaComparison area={area.data} /> : null}

      {/* Timeline */}
      <View
        style={styles.section}
        onLayout={(e) => {
          timelineY.current = e.nativeEvent.layout.y;
        }}
      >
        <SectionHead title="What inspectors found" />
        {shown.length === 0 ? (
          <T variant="callout" tone="secondary">
            The state has not posted any visits for this daycare in the last five years.
          </T>
        ) : (
          segments(shown).map((seg, i) => (
            <Fragment key={seg.kind === 'quiet' ? `q${seg.visits[0]?.activity_id}` : seg.visit.activity_id}>
              {i > 0 ? <Rule /> : null}
              {seg.kind === 'quiet' ? (
                <View
                  onLayout={(e) => {
                    for (const v of seg.visits) visitY.current.set(v.activity_id, e.nativeEvent.layout.y);
                  }}
                >
                  <QuietVisits visits={seg.visits} />
                </View>
              ) : (
              <View
                style={styles.visit}
                onLayout={(e) => {
                  visitY.current.set(seg.visit.activity_id, e.nativeEvent.layout.y);
                }}
              >
                <T variant="subhead" tabular accessibilityRole="header">
                  {formatDate(seg.visit.date) || 'Date not listed by the state'}
                  <T variant="footnote" tone="secondary">
                    {'  '}
                    {visitTypeLabel(seg.visit.type)}
                    {seg.visit.status === 'findings' ? ` · ${plural(seg.visit.findings.length, 'finding')}` : ''}
                  </T>
                </T>
                {seg.visit.status === 'pending' ? (
                  <T variant="callout" tone="secondary">
                    Findings from this visit aren&rsquo;t posted yet. The state usually posts them within a few weeks.
                  </T>
                ) : (
                  <View style={{ gap: space.xl }}>
                    {seg.visit.findings.map((f) => (
                      <FindingRow key={f.non_compliance_id} finding={f} visitDate={seg.visit.date} />
                    ))}
                  </View>
                )}
              </View>
              )}
            </Fragment>
          ))
        )}
        {hiddenQuiet > 0 ? (
          <T variant="footnote" tone="tertiary">
            Plus {plural(hiddenQuiet, 'earlier visit')} with no findings posted.
          </T>
        ) : null}
      </View>

      {/* Facts */}
      <View style={styles.section}>
        <SectionHead title="About this daycare" />
        <Facts daycare={daycare} />
      </View>

      {/* Act */}
      <View style={styles.section}>
        <SectionHead title="Before you tour or enroll" />
        <Surface>
          <RowLink
            title="Questions to ask on a tour"
            detail="Built from this daycare's own record"
            onPress={() => router.push(`/daycare/${operationId}/tour`)}
          />
          <Rule inset={space.xl} />
          <RowLink
            title="Your rights as a parent"
            detail="Request records or video, or drop in"
            onPress={() => router.push({ pathname: '/rights', params: { operationId: String(operationId) } })}
          />
          <Rule inset={space.xl} />
          <RowLink
            title="Official state record"
            detail="Texas Health and Human Services"
            external
            onPress={() => void WebBrowser.openBrowserAsync(official_url)}
          />
        </Surface>
      </View>

      <LastChecked fallback={last_checked_at} />
    </ScrollView>
  );
}

/** A run of visits where the state posted no findings, as one compact block. */
function QuietVisits({ visits }: { visits: Visit[] }) {
  const label = `${plural(visits.length, 'visit')} with no findings posted`;
  return (
    <View style={styles.quiet} accessible accessibilityLabel={`${label}: ${visits.map((v) => `${formatDate(v.date)}, ${visitTypeLabel(v.type)}`).join('; ')}`}>
      <T variant="footnote" tone="secondary">
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </T>
      {visits.map((v) => (
        <View key={v.activity_id} style={styles.quietRow}>
          <T variant="callout" tabular style={styles.quietDate}>
            {formatDate(v.date)}
          </T>
          <T variant="callout" tone="secondary" style={{ flex: 1 }}>
            {visitTypeLabel(v.type)}
          </T>
        </View>
      ))}
    </View>
  );
}

function StatusNotes({ daycare }: { daycare: DaycareHeader }) {
  const c = useColors();
  const notes = [
    daycare.status === 'inactive' ? 'The state lists this daycare’s permit as inactive.' : null,
    daycare.temporarily_closed ? 'State data marks this daycare as temporarily closed.' : null,
    daycare.adverse_action
      ? 'The state lists an adverse action against this daycare\u2019s permit, its most serious kind of action.'
      : null,
    daycare.corrective_action
      ? 'The state lists this daycare on corrective action (probation): it stays open under extra conditions and more inspections.'
      : null,
  ].filter((n): n is string => n !== null);
  if (notes.length === 0) return null;
  return (
    <View style={[styles.notes, { borderColor: c.border, backgroundColor: c.surface }]}>
      {notes.map((n) => (
        <T key={n} variant="callout">
          {n}
        </T>
      ))}
    </View>
  );
}

function AreaComparison({ area }: { area: AreaCompare }) {
  const c = useColors();
  if (area.peer_count < 3) return null;
  const rows: { label: string; key: keyof AreaCompare['this'] }[] = [
    { label: 'State visits', key: 'inspections' },
    { label: 'Visits with findings', key: 'inspections_with_findings' },
    { label: 'Findings', key: 'findings' },
    { label: 'High risk findings', key: 'findings_high' },
  ];
  const peers = `${plural(area.peer_count, operationTypeLabel(area.operation_type).toLowerCase())} in ${tidyCase(area.county)} County`;
  return (
    <View style={styles.section}>
      <SectionHead title="Compared with the county" />
      <T variant="body" tabular>
        <T variant="headline" tabular>
          {area.this.findings}
        </T>
        {area.this.findings === 1 ? ' finding' : ' findings'} here, against a median of{' '}
        <T variant="headline" tabular>
          {formatMedian(area.median.findings)}
        </T>{' '}
        for {peers}.
      </T>
      <T variant="callout" tone="secondary">
        Medians for the same type of daycare in the same county, last {area.window_months} months.
      </T>
      <View style={[styles.table, { borderColor: c.hairline }]}>
        <View style={styles.tr}>
          <T variant="caption" tone="tertiary" style={styles.tdLabel}>
            {' '}
          </T>
          <T variant="footnote" tone="secondary" style={styles.tdNum}>
            This daycare
          </T>
          <T variant="footnote" tone="secondary" style={styles.tdNum}>
            County median
          </T>
        </View>
        {rows.map((r) => (
          <View
            key={r.key}
            style={[styles.tr, { borderTopColor: c.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}
            accessible
            accessibilityLabel={`${r.label}: this daycare ${area.this[r.key]}, county median ${formatMedian(area.median[r.key])}`}
          >
            <T variant="callout" style={styles.tdLabel}>
              {r.label}
            </T>
            <T variant="headline" tabular style={styles.tdNum}>
              {area.this[r.key]}
            </T>
            <T variant="callout" tone="secondary" tabular style={styles.tdNum}>
              {formatMedian(area.median[r.key])}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Medians of whole counts can land on a half (an even number of peers). */
function formatMedian(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Facts({ daycare }: { daycare: DaycareHeader }) {
  const facts: [string, string][] = [
    ['Ages', agesLabel(daycare.ages)],
    ['Licensed for', daycare.capacity ? plural(daycare.capacity, 'child', 'children') : ''],
    ['Hours', [daysLabel(daycare.days), hoursLabel(daycare.hours)].filter(Boolean).join(', ')],
    [
      'Child care subsidies',
      daycare.subsidies === null ? '' : daycare.subsidies ? 'Accepts state subsidies' : 'Does not accept state subsidies',
    ],
    ['Address', [tidyCase(daycare.address), daycare.zip].filter(Boolean).join(' ')],
    ['Permit issued', formatDate(daycare.issuance_date)],
    ['Permit conditions', daycare.conditions_on_permit ? 'The state lists a special requirement on this permit' : ''],
  ];
  const shown = facts.filter(([, v]) => v);
  return (
    <View style={{ gap: space.md }}>
      {shown.map(([k, v]) => (
        <View key={k} style={styles.fact} accessible accessibilityLabel={`${k}: ${v}`}>
          <T variant="footnote" tone="secondary" style={styles.factKey}>
            {k}
          </T>
          <T variant="callout" style={{ flex: 1 }}>
            {v}
          </T>
        </View>
      ))}
      {daycare.district_basis === 'point' && daycare.in_district ? (
        <T variant="footnote" tone="tertiary">
          Located in Texas&rsquo;s 4th Congressional District.
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: space.section },
  pad: { padding: space.xl, gap: space.md },
  header: { gap: space.xs + 2, paddingTop: space.sm, paddingBottom: space.xl },
  actions: { marginTop: space.md },
  notes: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: space.md, gap: space.xs, marginTop: space.sm },
  section: { gap: space.md },
  watchingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: minTap },
  stop: { minHeight: minTap, minWidth: minTap, justifyContent: 'center', alignItems: 'flex-end' },
  visit: { paddingVertical: space.lg, gap: space.md },
  counts: { gap: space.xxs, paddingVertical: space.xs },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  countN: { width: 32 },
  quiet: { paddingVertical: space.lg, gap: space.xs },
  quietRow: { flexDirection: 'row', gap: space.md },
  quietDate: { width: 118 },
  table: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.xs },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingVertical: space.xs },
  tdLabel: { flex: 1.4 },
  tdNum: { flex: 1, textAlign: 'right' },
  fact: { flexDirection: 'row', gap: space.md },
  factKey: { width: 112, paddingTop: 2 },
});
