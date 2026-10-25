import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import Animated, {
  FadeIn,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { lawCovers, NOT_COVERED, REQUEST_CARDS, type RequestKind } from '@/lib/rights';
import type { AreaCompare, DaycareRecord } from '@/lib/types';
import { radius, space, useColors } from '@/theme';

import { Button } from './Button';
import { FactChips } from './Chip';
import { ActionPill, IconButton, SquareButton, StickyBar } from './Chrome';
import { FindingCard } from './FindingCard';
import type { GlyphName } from './Glyph';
import { Disclosure } from './Disclosure';
import { RingCard, StatBand } from './NumberCard';
import { type GeocodeQuality, PlaceGallery } from './PlaceGallery';
import { RecordStrip, stripFromRecord } from './RecordStrip';
import { RightCard } from './RightCard';
import { Tabs } from './Tabs';
import { Text } from './Text';

/**
 * The place page (googlemaps place sheet + doordash-3 store page + uber-3 sticky CTA, harness/state/refs).
 * Map hero, huge name, fact chips, action pills, tabs; the record strip and big counts lead Overview.
 * Data and navigation come in as props.
 */

export type { RequestKind };
type Tab = 'overview' | 'findings' | 'rights';

const HERO = 260;

type Props = {
  record: DaycareRecord;
  area: AreaCompare | null | undefined;
  watching: boolean;
  watchPending?: boolean;
  onWatch: () => void;
  onUnwatch: () => void;
  onBack: () => void;
  onShare: () => void;
  /** Fallback when the two map-app handlers aren't passed. */
  onDirections: () => void;
  onOpenAppleMaps?: () => void;
  onOpenGoogleMaps?: () => void;
  onOfficial: () => void;
  onTour: () => void;
  onRequest: (kind: RequestKind) => void;
  /** Rights source line, e.g. "Texas Human Resources Code §42.04271". */
  lawCite: string;
  /** "Last checked with the state …" (CONTRACT 3). */
  footer: ReactNode;
};

export function PlacePage({
  record,
  area,
  watching,
  watchPending,
  onWatch,
  onUnwatch,
  onBack,
  onShare,
  onDirections,
  onOpenAppleMaps,
  onOpenGoogleMaps,
  onOfficial,
  onTour,
  onRequest,
  lawCite,
  footer,
}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('overview');
  // Past the photo, a solid bar with the name fades in and the status bar turns dark (Apple Maps place card).
  const y = useSharedValue(0);
  const [solid, setSolid] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  useAnimatedReaction(
    () => y.value > HERO - 40,
    (now, before) => {
      if (now !== before) runOnJS(setSolid)(now);
    },
  );
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [HERO - 80, HERO - 20], [0, 1], 'clamp') }));
  const { daycare } = record;
  const s = summarize(record);
  const strip = stripFromRecord(record);
  const { shown } = visibleVisits(groupByVisit(record));
  const findingVisits = shown.filter((v) => v.status === 'findings');
  const verified = s.findings - s.notFixed;

  // First view: three facts a parent decides on (DESIGN.md §9). The rest sits in "More details".
  const facts: { icon: GlyphName; label: string; a11y: string }[] = [];
  const typeLabel = operationTypeLabel(daycare.operation_type);
  facts.push({ icon: daycare.operation_type === 'Licensed Center' ? 'center' : 'home', label: typeLabel, a11y: typeLabel });
  const ages = agesLabel(daycare.ages);
  if (ages) facts.push({ icon: 'ages', label: ages, a11y: `Ages: ${ages}` });
  const hours = [daysLabel(daycare.days), hoursLabel(daycare.hours)].filter(Boolean).join(' ');
  if (hours) facts.push({ icon: 'clock', label: hours, a11y: `Hours: ${hours}` });
  const more = [
    daycare.capacity ? `Licensed for up to ${daycare.capacity} children` : null,
    daycare.subsidies ? 'Accepts state child care subsidies' : null,
    daycare.issuance_date ? `Permit issued ${formatDate(daycare.issuance_date)}` : null,
  ].filter((m): m is string => m !== null);
  const quality = (daycare as typeof daycare & { geocode_quality?: GeocodeQuality | null }).geocode_quality;

  const notes = [
    daycare.status === 'inactive' ? 'The state lists this permit as inactive.' : null,
    daycare.temporarily_closed ? 'State data marks this daycare as temporarily closed.' : null,
    daycare.adverse_action ? 'The state lists an adverse action against this permit, its most serious kind of action.' : null,
    daycare.corrective_action ? 'The state lists this daycare on corrective action: it stays open under extra conditions and more inspections.' : null,
  ].filter((n): n is string => n !== null);

  const address = [
    daycare.address ? tidyCase(daycare.address) : null,
    [tidyCase(daycare.city), daycare.zip].filter(Boolean).join(' '),
    daycare.in_district && daycare.district_basis === 'point' ? 'TX-04' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      {/* Light status-bar text over the aerial photo. */}
      <StatusBar style={solid ? 'auto' : 'light'} />
      <Animated.ScrollView contentContainerStyle={{ paddingBottom: space.section }} onScroll={onScroll} scrollEventThrottle={16}>
        <PlaceGallery lat={daycare.lat} lng={daycare.lng} quality={quality} watched={watching} height={HERO + insets.top} bottomInset={radius.sheet} />

        <View style={[styles.head, { backgroundColor: c.surface }]}>
          <Text variant="display" accessibilityRole="header">
            {tidyCase(daycare.name)}
          </Text>
          <Text variant="callout" tone="secondary" selectable>
            {address}
          </Text>
          {notes.length > 0 ? (
            <View style={[styles.notes, { backgroundColor: c.sunken }]}>
              {notes.map((n) => (
                <Text key={n} variant="callout">
                  {n}
                </Text>
              ))}
            </View>
          ) : null}
          <FactChips facts={facts} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.bleed}>
            {onOpenAppleMaps && onOpenGoogleMaps ? (
              <>
                <ActionPill icon="map" label="Apple Maps" onPress={onOpenAppleMaps} />
                <ActionPill icon="directions" label="Google Maps" onPress={onOpenGoogleMaps} />
              </>
            ) : (
              <ActionPill icon="directions" label="Directions" onPress={onDirections} />
            )}
            <ActionPill icon="record" label="State record" onPress={onOfficial} />
          </ScrollView>
        </View>

        <View style={{ backgroundColor: c.surface }}>
          <Tabs
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'findings', label: s.findings > 0 ? `Findings ${s.findings}` : 'Findings' },
              { key: 'rights', label: 'Your rights' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        <Animated.View key={tab} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={styles.body}>
          {tab === 'overview' ? (
            <>
              <View style={{ gap: space.md }}>
                <Text variant="title">Last 24 months</Text>
                <RecordStrip visits={strip} variant="hero" months={s.months} onPressVisit={() => setTab('findings')} />
              </View>
              <StatBand
                items={[
                  { label: 'State visits', value: s.visits },
                  { label: 'Findings', value: s.findings },
                  { label: 'On High risk rules', value: s.high, tint: s.high > 0 ? c.risk.High : undefined },
                ]}
              />
              <Disclosure title="More details" detail="Fixes verified, the county, tour questions">
                {s.findings > 0 ? (
                  <RingCard
                    value={verified}
                    of={s.findings}
                    title="Verified fixed by the state"
                    sub={s.notFixed > 0 ? `${s.notFixed} not yet verified` : undefined}
                  />
                ) : null}
                {area && area.peer_count >= 3 ? <CountyCard area={area} /> : null}
                {more.length > 0 ? (
                  <View style={{ gap: space.xs }}>
                    {more.map((m) => (
                      <Text key={m} variant="callout">
                        {m}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <RightCard
                  icon="list"
                  title="Questions to ask on a tour"
                  detail="Built from this daycare's own findings"
                  hint="Opens the tour questions"
                  trailing="chevronRight"
                  onPress={onTour}
                />
              </Disclosure>
            </>
          ) : null}

          {tab === 'findings' ? (
            findingVisits.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: c.sunken }]}>
                <Text variant="headline">No findings posted</Text>
                <Text variant="callout" tone="secondary">
                  {`The state posted ${plural(s.visits, 'visit')} in the last 24 months with no findings.`}
                </Text>
              </View>
            ) : (
              findingVisits.map((v) => (
                <View key={v.activity_id} style={{ gap: space.md }}>
                  <View>
                    <Text variant="title" tabular>
                      {formatDate(v.date)}
                    </Text>
                    <Text variant="footnote" tone="secondary">
                      {`${visitTypeLabel(v.type)} · ${plural(v.findings.length, 'finding')}`}
                    </Text>
                  </View>
                  {v.findings.map((f) => (
                    <FindingCard key={f.non_compliance_id} finding={f} visitDate={v.date} />
                  ))}
                </View>
              ))
            )
          ) : null}

          {tab === 'rights' ? (
            <View>
              {lawCovers(daycare.operation_type) ? (
                REQUEST_CARDS.map((r) => (
                  <RightCard key={r.kind} icon={r.icon} title={r.title} detail={r.detail} onPress={() => onRequest(r.kind)} />
                ))
              ) : (
                <View style={[styles.empty, { backgroundColor: c.sunken }]}>
                  <Text variant="headline">{NOT_COVERED}</Text>
                  <Text variant="callout" tone="secondary">
                    You can still read every inspection the state posts here.
                  </Text>
                </View>
              )}
              <Text variant="footnote" tone="tertiary" style={{ marginTop: space.lg }}>
                {lawCite}
              </Text>
            </View>
          ) : null}

          {footer}
        </Animated.View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[styles.bar, { height: insets.top + 56, paddingTop: insets.top, backgroundColor: c.surface, borderBottomColor: c.hairline }, barStyle]}
      >
        <Text variant="headline" numberOfLines={1} style={{ marginHorizontal: 64 }} align="center">
          {tidyCase(daycare.name)}
        </Text>
      </Animated.View>

      <View style={[styles.floatTop, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <IconButton icon="back" label="Back" onPress={onBack} size={40} tone="surface" />
      </View>

      <StickyBar>
        {watching ? (
          <Button
            label="Watching · alerts on"
            kind="primary"
            icon="bellFill"
            onPress={onUnwatch}
            disabled={watchPending}
            accessibilityHint="Stops alerts for this daycare"
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            label="Watch this daycare"
            kind="ink"
            icon="bell"
            onPress={onWatch}
            disabled={watchPending}
            accessibilityHint="Get an alert when the state posts something new about this daycare"
            style={{ flex: 1 }}
          />
        )}
        <SquareButton icon="share" label="Share" onPress={onShare} />
      </StickyBar>
    </View>
  );
}

function CountyCard({ area }: { area: AreaCompare }) {
  const c = useColors();
  const median = Number.isInteger(area.median.findings) ? String(area.median.findings) : area.median.findings.toFixed(1);
  const peers = `${plural(area.peer_count, operationTypeLabel(area.operation_type).toLowerCase())} in ${tidyCase(area.county)} County`;
  const max = Math.max(area.this.findings, area.median.findings, 1);
  const rows = [
    { label: 'This daycare', value: String(area.this.findings), share: area.this.findings / max, color: c.text },
    { label: 'County median', value: median, share: area.median.findings / max, color: c.textTertiary },
  ];
  return (
    <View accessible accessibilityLabel={`Findings in 24 months: this daycare ${area.this.findings}, median ${median} for ${peers}`} style={{ gap: space.md }}>
      <Text variant="title">Next to the county</Text>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: space.xs }}>
          <View style={styles.countyRow}>
            <Text variant="subhead" style={{ flex: 1 }}>
              {r.label}
            </Text>
            <Text variant="headline" tabular>
              {r.value}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: c.sunken }]}>
            <View style={[styles.bar2, { width: `${Math.max(r.share * 100, 2)}%`, backgroundColor: r.color }]} />
          </View>
        </View>
      ))}
      <Text variant="footnote" tone="tertiary">
        {`Findings in the last ${area.window_months} months. Median of ${peers}.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    marginTop: -radius.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
    gap: space.sm,
  },
  notes: { borderRadius: radius.card, padding: space.md, gap: space.xs, marginTop: space.xs },
  bleed: { marginHorizontal: -space.lg, flexGrow: 0 },
  row: { paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.sm },
  body: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xxl },
  empty: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
  countyRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.lg },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bar2: { height: 10, borderRadius: 5 },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  floatTop: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
});
