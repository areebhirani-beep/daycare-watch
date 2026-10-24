import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Fragment } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { FindingRow } from '@/components/FindingRow';
import { RecordSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, LastChecked, RowLink, Rule, SectionLabel, Surface } from '@/components/ui';
import { useAreaCompare, useDaycareRecord, useIsWatching } from '@/lib/api';
import {
  agesLabel,
  daysLabel,
  formatDate,
  hoursLabel,
  operationTypeLabel,
  plural,
  tidyCase,
} from '@/lib/format';
import { groupByVisit, summarize, visibleVisits, visitTypeLabel } from '@/lib/record';
import type { AreaCompare, DaycareHeader } from '@/lib/types';
import { space, useColors } from '@/theme';

export default function DaycareRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const operationId = Number(id);
  const c = useColors();
  const record = useDaycareRecord(operationId);
  const area = useAreaCompare(operationId);
  const watching = useIsWatching(operationId);

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
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={record.isRefetching} onRefresh={() => void record.refetch()} />
      }
    >
      <Stack.Screen options={{ title: '' }} />

      {/* Header */}
      <View style={styles.header}>
        <T variant="largeTitle" accessibilityRole="header">
          {name}
        </T>
        <T variant="callout" tone="secondary">
          {[operationTypeLabel(daycare.operation_type), tidyCase(daycare.city)].filter(Boolean).join(' · ')}
        </T>
        <StatusNotes daycare={daycare} />
        <View style={styles.actions}>
          {watching ? (
            <Button
              label="Watching"
              kind="secondary"
              icon="check"
              accessibilityHint="Opens watch settings"
              onPress={() => router.push(`/daycare/${operationId}/watch`)}
            />
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
        <SectionLabel>{`Last ${summary.months} months`}</SectionLabel>
        <T variant="title" tabular>
          {summary.findings === 0
            ? 'No findings posted'
            : `${plural(summary.findings, 'finding')} from ${plural(summary.visitsWithFindings, 'visit')}`}
        </T>
        <T variant="callout" tone="secondary" tabular>
          {[
            `${plural(summary.visits, 'state visit')} in total`,
            summary.high > 0 ? `${summary.high} on High risk rules` : null,
            summary.notFixed > 0 ? `${summary.notFixed} with no fix date on record` : null,
            summary.repeatedRules > 0 ? `${plural(summary.repeatedRules, 'rule')} cited more than once` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </T>
        {summary.lastVisit ? (
          <T variant="callout" tone="secondary">
            Last state visit {formatDate(summary.lastVisit)}
          </T>
        ) : null}
      </View>

      {area.data ? <AreaComparison area={area.data} /> : null}

      {/* Timeline */}
      <View style={styles.section}>
        <SectionLabel>What inspectors found</SectionLabel>
        {shown.length === 0 ? (
          <T variant="callout" tone="secondary">
            The state has not posted any visits for this daycare in the last five years.
          </T>
        ) : (
          shown.map((v, i) => (
            <Fragment key={v.activity_id}>
              {i > 0 ? <Rule /> : null}
              <View style={styles.visit}>
                <T variant="subhead" tabular accessibilityRole="header">
                  {formatDate(v.date)}
                  <T variant="footnote" tone="secondary">
                    {'  '}
                    {visitTypeLabel(v.type)}
                    {v.status === 'findings' ? ` · ${plural(v.findings.length, 'finding')}` : ''}
                  </T>
                </T>
                {v.status === 'none' ? (
                  <T variant="callout" tone="secondary">
                    No findings posted from this visit.
                  </T>
                ) : v.status === 'pending' ? (
                  <T variant="callout" tone="secondary">
                    Findings from this visit aren&rsquo;t posted yet. The state usually posts them within a few weeks.
                  </T>
                ) : (
                  <View style={{ gap: space.xl }}>
                    {v.findings.map((f) => (
                      <FindingRow key={f.non_compliance_id} finding={f} />
                    ))}
                  </View>
                )}
              </View>
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
        <SectionLabel>About this daycare</SectionLabel>
        <Facts daycare={daycare} />
      </View>

      {/* Act */}
      <View style={styles.section}>
        <SectionLabel>Before you tour or enroll</SectionLabel>
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

function StatusNotes({ daycare }: { daycare: DaycareHeader }) {
  const c = useColors();
  const notes = [
    daycare.status === 'inactive' ? 'The state lists this daycare’s permit as inactive.' : null,
    daycare.temporarily_closed ? 'The state lists this daycare as temporarily closed.' : null,
    daycare.adverse_action ? 'The state lists this daycare under adverse action.' : null,
    daycare.corrective_action ? 'The state lists this daycare under corrective action.' : null,
    daycare.conditions_on_permit ? 'The state has placed conditions on this daycare’s permit.' : null,
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
      <SectionLabel>In context</SectionLabel>
      <T variant="callout" tone="secondary">
        Compared with the median of {peers}, last {area.window_months} months.
      </T>
      <View style={[styles.table, { borderColor: c.hairline }]}>
        <View style={styles.tr}>
          <T variant="caption" tone="tertiary" style={styles.tdLabel}>
            {' '}
          </T>
          <T variant="caption" tone="secondary" style={styles.tdNum}>
            THIS DAYCARE
          </T>
          <T variant="caption" tone="secondary" style={styles.tdNum}>
            AREA MEDIAN
          </T>
        </View>
        {rows.map((r) => (
          <View
            key={r.key}
            style={[styles.tr, { borderTopColor: c.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}
            accessible
            accessibilityLabel={`${r.label}: this daycare ${area.this[r.key]}, area median ${area.median[r.key]}`}
          >
            <T variant="callout" style={styles.tdLabel}>
              {r.label}
            </T>
            <T variant="headline" tabular style={styles.tdNum}>
              {area.this[r.key]}
            </T>
            <T variant="callout" tone="secondary" tabular style={styles.tdNum}>
              {area.median[r.key]}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
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
  section: { paddingTop: space.xxl, gap: space.sm },
  visit: { paddingVertical: space.lg, gap: space.md },
  table: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.xs },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingVertical: space.xs },
  tdLabel: { flex: 1.4 },
  tdNum: { flex: 1, textAlign: 'right' },
  fact: { flexDirection: 'row', gap: space.md },
  factKey: { width: 112, paddingTop: 2 },
});
