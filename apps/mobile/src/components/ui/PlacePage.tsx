import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, View } from 'react-native';

import Animated, {
  FadeIn,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
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
import { imageryAllowed } from '@/lib/imagery';
import { placeAddress } from '@/lib/maps';
import { buildTourQuestions } from '@/lib/tour';
import { lawCovers, NOT_COVERED, REQUEST_CARDS, type RequestKind } from '@/lib/rights';
import type { AreaCompare, DaycareRecord } from '@/lib/types';
import { haptic, radius, riskRank, space, spring, useColors } from '@/theme';

import { Button } from './Button';
import { FactChips } from './Chip';
import { ActionTile, IconButton, SquareButton, StickyBar } from './Chrome';
import { FindingCard } from './FindingCard';
import { Glyph, type GlyphName } from './Glyph';
import { Disclosure } from './Disclosure';
import { MapSnapshot } from './MapSnapshot';
import { RingCard } from './NumberCard';
import { type GeocodeQuality, PlaceGallery } from './PlaceGallery';
import { RecordStrip, stripFromRecord } from './RecordStrip';
import { RightCard } from './RightCard';
import { Tabs } from './Tabs';
import { Text } from './Text';

/**
 * The place page (googlemaps place sheet + doordash-3 store page + uber-3 sticky CTA, harness/state/refs).
 * Map hero, huge name, then the record itself (days since the last visit, the visit rail, one sentence),
 * fact chips, action tiles, tabs. Tour questions lead Overview.
 * Data and navigation come in as props.
 */

export type { RequestKind };
type Tab = 'overview' | 'findings' | 'rights';

const HERO = 236;

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
  const hasPoint = typeof record.daycare.lat === 'number' && typeof record.daycare.lng === 'number';
  // No map location in the state record: a short band, not an empty map that pretends to be one.
  const heroH = hasPoint ? HERO : 72;
  // Past the photo, a solid bar with the name fades in and the status bar turns dark (Apple Maps place card).
  const y = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [solid, setSolid] = useState(false);
  // The bar's slim aerial only loads once the reader scrolls toward it (tiles load on view).
  const [barImage, setBarImage] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  useAnimatedReaction(
    () => y.value > heroH - 40,
    (now, before) => {
      if (now !== before) runOnJS(setSolid)(now);
    },
  );
  useAnimatedReaction(
    () => y.value > heroH - 160,
    (now) => {
      if (now) runOnJS(setBarImage)(true);
    },
  );
  // The bar is fully solid before the large title reaches it, and the large title fades as it passes under,
  // so the two names never overlap (Apple's large-title collapse).
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [heroH - 110, heroH - 50], [0, 1], 'clamp') }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [heroH - 60, heroH + 10], [1, 0], 'clamp') }));

  // Watch confirm: success haptic and a spring pop the moment watching turns on.
  const pop = useSharedValue(1);
  const wasWatching = useRef(watching);
  useEffect(() => {
    if (watching && !wasWatching.current) {
      haptic.success();
      pop.value = withSequence(withSpring(1.05, spring.pop), withSpring(1, spring.pop));
    }
    wasWatching.current = watching;
  }, [watching, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
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
  // Home daycares are private residences (lib/imagery): the hero shows only the neighborhood, so the page
  // doesn't print the street or hand out turn-by-turn directions to the house either.
  const privateHome = !imageryAllowed(daycare.operation_type);
  const aerial = hasPoint && !privateHome && quality !== 'non_exact';

  const notes = [
    daycare.status === 'inactive' ? 'The state lists this permit as inactive.' : null,
    daycare.temporarily_closed ? 'State data marks this daycare as temporarily closed.' : null,
    daycare.adverse_action ? 'The state lists an adverse action against this permit, its most serious kind of action.' : null,
    daycare.corrective_action ? 'The state lists this daycare on corrective action: it stays open under extra conditions and more inspections.' : null,
  ].filter((n): n is string => n !== null);

  // Centers: the state's full address line. Homes: city and ZIP only (lib/maps).
  const address = [tidyCase(placeAddress(daycare)).replace(/\bTx\b/, 'TX'), daycare.in_district && daycare.district_basis === 'point' ? 'TX-04' : null]
    .filter(Boolean)
    .join(' · ');
  const tour = useMemo(() => buildTourQuestions(record.findings).slice(0, 2), [record.findings]);

  // Tapping a visit on the rail opens Findings scrolled to that visit.
  const bodyTop = useRef(0);
  const [target, setTarget] = useState<string | number | null>(null);
  const jumpTo = (id: string | number) => {
    setTab('findings');
    setTarget(id);
  };
  const onVisitLayout = (id: string | number) => (e: LayoutChangeEvent) => {
    if (id !== target) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, bodyTop.current + e.nativeEvent.layout.y - insets.top - 56 - space.md), animated: true });
    setTarget(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      {/* Light status-bar text over the aerial photo and the dimmed header; the street maps follow the theme. */}
      <StatusBar style={(solid ? hasPoint : aerial) ? 'light' : 'auto'} />
      <Animated.ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: space.section }} onScroll={onScroll} scrollEventThrottle={16}>
        <PlaceGallery
          lat={daycare.lat}
          lng={daycare.lng}
          quality={quality}
          imagery={!privateHome}
          watched={watching}
          height={heroH + insets.top}
          bottomInset={radius.sheet}
        />

        <View style={[styles.head, { backgroundColor: c.surface }]}>
          <Animated.View style={nameStyle}>
            <Text variant="display" accessibilityRole="header">
              {tidyCase(daycare.name)}
            </Text>
          </Animated.View>
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
          <View style={styles.record}>
            <HeroFact lastVisit={s.lastVisit} visits={s.visits} months={s.months} />
            <RecordStrip visits={strip} variant="hero" months={s.months} onPressVisit={jumpTo} />
            <RecordLine s={s} area={area} />
          </View>
          <FactChips facts={facts} />
          <View style={styles.tiles}>
            {privateHome ? null : onOpenAppleMaps && onOpenGoogleMaps ? (
              <>
                <ActionTile icon="map" label="Apple Maps" onPress={onOpenAppleMaps} />
                <ActionTile icon="directions" label="Google Maps" onPress={onOpenGoogleMaps} />
              </>
            ) : (
              <ActionTile icon="directions" label="Directions" onPress={onDirections} />
            )}
            <ActionTile icon="record" label="State record" onPress={onOfficial} />
          </View>
        </View>

        <View
          style={{ backgroundColor: c.surface }}
          onLayout={(e) => {
            bodyTop.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
          }}
        >
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
              <TourCard questions={tour} onOpen={onTour} />
              <Disclosure title="More details" detail="Fixes verified, permit, capacity">
                {s.findings > 0 ? (
                  <RingCard
                    value={verified}
                    of={s.findings}
                    title="Verified fixed by the state"
                    sub={s.notFixed > 0 ? `${s.notFixed} not yet verified` : undefined}
                  />
                ) : null}
                {more.length > 0 ? (
                  <View style={{ gap: space.xs }}>
                    {more.map((m) => (
                      <Text key={m} variant="callout">
                        {m}
                      </Text>
                    ))}
                  </View>
                ) : null}
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
              findingVisits.map((v) => {
                // Highest-risk first. Two or more lower-risk findings fold into one row.
                const sorted = [...v.findings].sort((a, b) => riskRank[b.risk_level] - riskRank[a.risk_level]);
                const lower = sorted.filter((f) => riskRank[f.risk_level] <= 2);
                const fold = lower.length >= 2;
                const shown = fold ? sorted.filter((f) => riskRank[f.risk_level] > 2) : sorted;
                return (
                  <View key={v.activity_id} style={{ gap: space.md }} onLayout={onVisitLayout(v.activity_id)}>
                    <View>
                      <Text variant="title" tabular>
                        {formatDate(v.date)}
                      </Text>
                      <Text variant="footnote" tone="secondary">
                        {`${visitTypeLabel(v.type)} · ${plural(v.findings.length, 'finding')}`}
                      </Text>
                    </View>
                    {shown.map((f) => (
                      <FindingCard key={f.non_compliance_id} finding={f} visitDate={v.date} />
                    ))}
                    {fold ? (
                      <Disclosure title={`${lower.length} lower-risk findings`} detail="Rules the state rates Low or Medium Low">
                        {lower.map((f) => (
                          <FindingCard key={f.non_compliance_id} finding={f} visitDate={v.date} />
                        ))}
                      </Disclosure>
                    ) : null}
                  </View>
                );
              })
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
        {/* The page keeps its picture: a slim, dimmed slice of the hero map behind the name. */}
        {hasPoint && barImage ? (
          <>
            <MapSnapshot
              lat={daycare.lat}
              lng={daycare.lng}
              zoom={privateHome ? 14 : 16}
              privateHome={privateHome}
              showPin={false}
              attribution="short"
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, styles.scrim]} />
          </>
        ) : null}
        <Text variant="headline" numberOfLines={1} color={hasPoint ? '#FFFFFF' : undefined} style={{ marginHorizontal: 64 }} align="center">
          {tidyCase(daycare.name)}
        </Text>
      </Animated.View>

      <View style={[styles.floatTop, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <IconButton icon="back" label="Back" onPress={onBack} size={40} tone="surface" />
      </View>

      <StickyBar>
        {Platform.OS === 'web' ? (
          // The web link is read-only: no account, no push. One quiet line instead of a button that can't work.
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text variant="subhead" style={{ fontWeight: '600' }}>
              Alerts need the app
            </Text>
            <Text variant="footnote" tone="secondary">
              Watch a daycare on iPhone or Android to get the state’s next post.
            </Text>
          </View>
        ) : (
        <Animated.View style={[{ flex: 1 }, popStyle]}>
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
        </Animated.View>
        )}
        <SquareButton icon="share" label="Share" onPress={onShare} />
      </StickyBar>
    </View>
  );
}

/**
 * The page's one giant number (DESIGN.md §9): days since the state's last visit. A date fact from the
 * record, never a grade. With no visit in the window it counts visits instead (0).
 */
function HeroFact({ lastVisit, visits, months }: { lastVisit: string | null; visits: number; months: number }) {
  // Today is read once per mount; the count is whole days, so it can't drift while the page is open.
  const [today] = useState(() => new Date().setHours(12, 0, 0, 0));
  const days = lastVisit ? Math.max(0, Math.round((today - new Date(`${lastVisit}T12:00:00`).getTime()) / 86_400_000)) : null;
  return (
    <View
      accessible
      accessibilityLabel={days != null ? `${days} days since the state's last visit, on ${formatDate(lastVisit)}` : `No state visits in ${months} months`}
      style={{ gap: space.xxs }}
    >
      {/* The line box keeps descender room the digits never use; pull the label up so number and label read as one. */}
      <Text variant="hero" tabular style={{ marginBottom: -14 }}>
        {days != null ? String(days) : String(visits)}
      </Text>
      <Text variant="title">{days != null ? (days === 1 ? 'day since the state’s last visit' : 'days since the state’s last visit') : `state visits in ${months} months`}</Text>
      {days != null ? (
        <Text variant="callout" tone="secondary" tabular>
          {`Last visit ${formatDate(lastVisit)}`}
        </Text>
      ) : null}
    </View>
  );
}

/** The record in one plain sentence under the rail, plus the county median when there are enough peers. Facts only. */
function RecordLine({ s, area }: { s: ReturnType<typeof summarize>; area: AreaCompare | null | undefined }) {
  const [since] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - s.months, d.getDate()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });
  const line =
    s.visits === 0
      ? `No state visits posted since ${since}`
      : s.findings === 0
      ? `${plural(s.visits, 'state visit')} since ${since}, no findings posted`
      : `${plural(s.findings, 'finding')} across ${plural(s.visits, 'state visit')} since ${since}${s.high > 0 ? ` · ${s.high} on a High-risk rule` : ''}`;
  const median = area && area.peer_count >= 3 ? (Number.isInteger(area.median.findings) ? String(area.median.findings) : area.median.findings.toFixed(1)) : null;
  return (
    <View style={{ gap: space.xxs }}>
      <Text variant="callout" tabular style={{ fontWeight: '600' }}>
        {line}
      </Text>
      {area && median != null ? (
        <Text variant="footnote" tone="secondary" tabular>
          {`Median for ${operationTypeLabel(area.operation_type).toLowerCase()}s in ${tidyCase(area.county)} County: ${plural(Number(median), 'finding')} in ${area.window_months} months`}
        </Text>
      ) : null}
    </View>
  );
}

/** Tour questions built from this daycare's own findings (lib/tour), promoted to the top of Overview. */
function TourCard({ questions, onOpen }: { questions: ReturnType<typeof buildTourQuestions>; onOpen: () => void }) {
  const c = useColors();
  if (questions.length === 0) return null;
  return (
    <View style={[styles.tour, { backgroundColor: c.sunken }]}>
      <Text variant="title">Ask about these on your tour</Text>
      {questions.map((q, i) => (
        <View key={q.question} style={styles.tourRow}>
          <View style={[styles.tourNum, { backgroundColor: c.text }]}>
            <Text variant="footnote" color={c.surface} tabular style={{ fontWeight: '800' }}>
              {String(i + 1)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text variant="headline">{q.question}</Text>
            {q.fact ? (
              <Text variant="footnote" tone="secondary">
                {q.fact}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          haptic.select();
          onOpen();
        }}
        style={({ pressed }) => [styles.tourMore, { borderTopColor: c.hairline }, pressed && { opacity: 0.6 }]}
      >
        <Text variant="subhead" style={{ flex: 1, fontWeight: '600' }}>
          All tour questions
        </Text>
        <Glyph name="chevronRight" size={13} color={c.textSecondary} weight="bold" />
      </Pressable>
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
  tiles: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  body: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xxl },
  empty: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
  record: { gap: space.md, paddingTop: space.lg, paddingBottom: space.md },
  tour: { borderRadius: radius.card, padding: space.lg, gap: space.lg },
  tourRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  tourNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tourMore: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, minHeight: 44 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.52)' },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  floatTop: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
});
