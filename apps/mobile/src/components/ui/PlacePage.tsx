import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

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
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { agesLabel, daysLabel, formatDate, formatDateShort, hoursLabel, isFixed, operationTypeLabel, plural, tidyCase } from '@/lib/format';
import { activityNoun, activityPhrase, groupByVisit, type Visit, visitTypeLabel } from '@/lib/record';
import { imageryAllowed } from '@/lib/imagery';
import { placeAddress } from '@/lib/maps';
import { buildTourQuestions } from '@/lib/tour';
import { lawCovers, NOT_COVERED, REQUEST_CARDS, type RequestKind } from '@/lib/rights';
import type { AreaCompare, DaycareRecord, Finding } from '@/lib/types';
import { elevation, easeOut, haptic, motion, radius, riskRank, space, useColors } from '@/theme';

import { Button } from './Button';
import { FactChips } from './Chip';
import { CategoryIcon } from './CategoryIcon';
import { ActionTile, IconButton, SquareButton, StickyBar } from './Chrome';
import { FindingCard, SeriousTag } from './FindingCard';
import { Glyph, type GlyphName } from './Glyph';
import { Disclosure } from './Disclosure';
import { MapSnapshot } from './MapSnapshot';
import { flyoverAllowed } from './FlyoverHero';
import { pinKind } from './MapPin';
import { type GeocodeQuality, PlaceGallery } from './PlaceGallery';
import { RightCard } from './RightCard';
import { latestOpen, plainStatus, shortStatus, visitStatus } from './status';
import { Tabs } from './Tabs';
import { Text } from './Text';

/**
 * The place page (Google Maps place sheet + DoorDash store page + Uber sticky action bar).
 * It answers one question first: what did the state find here? Map hero, name, the answer in one sentence,
 * the top two problems in the state's own words, then chips, tiles and tabs. Overview holds the past two
 * years as one row per visit (Apple Weather's 10-day list) and the tour questions.
 * Three type sizes: 28 (the answer), 22 (name, section titles), 15 (everything else, grey for meta).
 * Data and navigation come in as props.
 */

export type { RequestKind };
type Tab = 'overview' | 'findings' | 'rights';

const HERO = 236;
const MONTHS = 24;

type Props = {
  record: DaycareRecord;
  area: AreaCompare | null | undefined;
  watching: boolean;
  /** False when the OS has notifications off: the button must not claim alerts are on (QA D9). */
  alertsOn?: boolean;
  watchPending?: boolean;
  onWatch: () => void;
  onUnwatch: () => void;
  onBack: () => void;
  onShare: () => void;
  /** Fallback when the two map-app handlers aren't passed. */
  onDirections: () => void;
  onOpenAppleMaps?: () => void;
  onOpenGoogleMaps?: () => void;
  /** Opens the center's Google Maps listing for its photos (lib/maps googlePhotosUrl); absent for homes. */
  onGooglePhotos?: () => void;
  onOfficial: () => void;
  onTour: () => void;
  /** Opens "What the categories mean" (CategoryGuide). Without it the link is hidden. */
  onCategories?: () => void;
  onRequest: (kind: RequestKind) => void;
  /** Rights source line, e.g. "Texas Human Resources Code §42.04271". */
  lawCite: string;
  /** "Last checked with the state …": every data screen says when it last matched the state. */
  footer: ReactNode;
};

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Highest-risk first, then newest. */
export function byWeight(a: Finding, b: Finding): number {
  return riskRank[b.risk_level] - riskRank[a.risk_level] || (b.date ?? '').localeCompare(a.date ?? '');
}

export function PlacePage({
  record,
  area,
  watching,
  alertsOn = true,
  watchPending,
  onWatch,
  onUnwatch,
  onBack,
  onShare,
  onDirections,
  onOpenAppleMaps,
  onOpenGoogleMaps,
  onGooglePhotos,
  onOfficial,
  onTour,
  onCategories,
  onRequest,
  lawCite,
  footer,
}: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [tab, setTab] = useState<Tab>('overview');
  const hasPoint = typeof record.daycare.lat === 'number' && typeof record.daycare.lng === 'number';
  // No map location in the state record: a short band, not an empty map that pretends to be one.
  const heroH = hasPoint ? HERO : 72;
  // Past the photo, a bar with the name fades in over a dimmed slice of the map (Apple Maps place card).
  const y = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [solid, setSolid] = useState(false);
  // The bar's slim map only loads once the reader scrolls toward it (tiles load on view).
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
  // The bar is fully in before the name reaches it, and the name fades as it passes under (large-title collapse).
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [heroH - 110, heroH - 50], [0, 1], 'clamp'),
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [heroH - 40, heroH + 10], [1, 0], 'clamp'),
  }));

  // Watch confirm: success haptic and a 200 ms cross-fade into the watching state. No scale (motion rules).
  const pop = useSharedValue(1);
  const wasWatching = useRef(watching);
  useEffect(() => {
    if (watching && !wasWatching.current) {
      haptic.success();
      pop.value = withSequence(
        withTiming(0.5, { duration: 0 }),
        withTiming(1, {
          duration: motion.base,
          easing: easeOut,
          reduceMotion: ReduceMotion.System,
        }),
      );
    }
    wasWatching.current = watching;
  }, [watching, pop]);
  const popStyle = useAnimatedStyle(() => ({ opacity: pop.value }));

  const { daycare } = record;
  // Today and the 24-month cutoff are read once per mount, so render stays pure.
  const [today] = useState(() => isoDay(new Date()));
  const [cutoff] = useState(() => {
    const d = new Date();
    return isoDay(new Date(d.getFullYear(), d.getMonth() - MONTHS, d.getDate()));
  });
  const visits = useMemo(() => groupByVisit(record).filter((v) => v.date >= cutoff), [record, cutoff]);
  const problems = useMemo(() => record.findings.filter((f) => f.date !== null && f.date >= cutoff), [record.findings, cutoff]);
  const findingVisits = visits.filter((v) => v.status === 'findings');
  const last = visits[0];
  // The card's rows belong to the activity its headline names; only when that one was clean do earlier problems
  // show, labelled as earlier.
  const top = useMemo(
    // The latest visit's problems all show (up to three), so the headline's count and the list agree.
    () => [...(last && last.findings.length > 0 ? last.findings : problems)].sort(byWeight).slice(0, last && last.findings.length > 0 ? 3 : 2),
    [last, problems],
  );

  // Three facts a parent decides on (DESIGN.md §9). The rest sits in "More details".
  const facts: { icon: GlyphName; label: string; a11y: string }[] = [];
  const typeLabel = operationTypeLabel(daycare.operation_type);
  facts.push({
    icon: daycare.operation_type === 'Licensed Center' ? 'center' : 'home',
    label: typeLabel,
    a11y: typeLabel,
  });
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
    daycare.corrective_action
      ? 'The state lists this daycare on corrective action: it stays open under extra conditions and more inspections.'
      : null,
  ].filter((n): n is string => n !== null);

  // Centers: the state's full address line. Homes: city and ZIP only (lib/maps).
  const address = [
    // Five-digit ZIP: the state's ZIP+4 is noise to a parent.
    tidyCase(placeAddress(daycare)).replace(/\bTx\b/, 'TX').replace(/\b(\d{5})-\d{4}\b/, '$1'),
    daycare.in_district && daycare.district_basis === 'point' ? 'TX‑04' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const tour = useMemo(() => buildTourQuestions(record.findings).slice(0, 2), [record.findings]);

  // "See all" and a tap on a past visit open Problems, scrolled to the tabs or to that visit.
  const bodyTop = useRef(0);
  const [target, setTarget] = useState<number | null>(null);
  const toTabs = () =>
    scrollRef.current?.scrollTo({
      y: Math.max(0, bodyTop.current - insets.top - 56 - 48),
      animated: true,
    });
  const seeAll = () => {
    haptic.select();
    setTab('findings');
    toTabs();
  };
  const jumpTo = (id: number) => {
    haptic.select();
    setTab('findings');
    setTarget(id);
  };
  const onVisitLayout = (id: number) => (e: LayoutChangeEvent) => {
    if (id !== target) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, bodyTop.current + e.nativeEvent.layout.y - insets.top - 56 - space.md),
      animated: true,
    });
    setTarget(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Light status-bar text over the aerial photo and the dimmed bar; the street maps follow the theme. Only while
          this page is on top: a screen pushed over it (Tour questions, an alert) keeps the app's own style. */}
      {focused ? <StatusBar style={(solid ? hasPoint : aerial) ? 'light' : 'auto'} /> : null}
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: space.section }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <PlaceGallery
          id={daycare.operation_id}
          name={daycare.name}
          lat={daycare.lat}
          lng={daycare.lng}
          quality={quality}
          imagery={!privateHome}
          flyover={flyoverAllowed(daycare)}
          photos={record.photos}
          streetChecked={daycare.street_view_checked}
          kind={pinKind(daycare.operation_type)}
          watched={watching}
          height={heroH + insets.top}
          bottomInset={radius.sheet}
        />

        <View style={[styles.head, { backgroundColor: c.bg }]}>
          <Animated.View style={[{ gap: space.xxs }, nameStyle]}>
            <Text variant="title">{tidyCase(daycare.name)}</Text>
            <Text variant="callout" tone="secondary" selectable>
              {address}
            </Text>
          </Animated.View>
          {notes.length > 0 ? (
            <View style={[styles.notes, elevation.card, { backgroundColor: c.surface }]}>
              {notes.map((n) => (
                <Text key={n} variant="callout">
                  {n}
                </Text>
              ))}
            </View>
          ) : null}

          {/* The answer and its top problems are one white card on the grey page (V4 surfaces). */}
          <View style={[styles.card, elevation.card, { backgroundColor: c.surface }]}>
          <Answer last={last} today={today} />
          {top.length > 0 ? (
            <TopProblems
              items={top}
              total={problems.length}
              today={today}
              said={last && last.findings.length > 0 ? { date: last.date, status: visitAnswer(last, today).sub } : null}
              onSeeAll={seeAll}
              // When the latest visit was clean, the problems shown come from earlier visits: say so.
              label={last && last.findings.length === 0 ? 'Earlier in the past 2 years' : null}
            />
          ) : null}
          </View>

          <FactChips facts={facts} />
          <View style={styles.tiles}>
            {/* The state's own page leads (it's the source); one Directions action in the phone's own maps app. */}
            <ActionTile icon="record" label="State record" onPress={onOfficial} />
            {privateHome ? null : (
              <ActionTile
                icon="directions"
                label="Directions"
                onPress={(Platform.OS === 'ios' ? onOpenAppleMaps : onOpenGoogleMaps) ?? onDirections}
              />
            )}
            {onGooglePhotos ? <ActionTile icon="photo" label="Photos on Google Maps" lines={2} onPress={onGooglePhotos} /> : null}
          </View>
        </View>

        <View
          style={{ backgroundColor: c.bg }}
          onLayout={(e) => {
            bodyTop.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height;
          }}
        >
          <Tabs
            tabs={[
              { key: 'overview', label: 'Overview' },
              {
                key: 'findings',
                label: problems.length > 0 ? `Problems ${problems.length}` : 'Problems',
              },
              { key: 'rights', label: 'Your rights' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        <Animated.View key={tab} entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={styles.body}>
          {tab === 'overview' ? (
            <>
              <History visits={visits} today={today} area={area} onPress={jumpTo} />
              <TourCard questions={tour} onOpen={onTour} />
              {more.length > 0 ? (
                <View style={[styles.cardTight, elevation.card, { backgroundColor: c.surface }]}>
                <Disclosure title="More details" detail="Capacity, subsidies, permit">
                  <View style={{ gap: space.xs }}>
                    {more.map((m) => (
                      <Text key={m} variant="callout">
                        {m}
                      </Text>
                    ))}
                  </View>
                </Disclosure>
                </View>
              ) : null}
            </>
          ) : null}

          {tab === 'findings' ? (
            findingVisits.length === 0 ? (
              <View style={[styles.empty, elevation.card, { backgroundColor: c.surface }]}>
                <Text variant="subhead">{visits.length > 0 ? 'No problems posted in 2 years' : 'No state visits posted in 2 years'}</Text>
                <Text variant="callout" tone="secondary">
                  {visits.length > 0
                    ? `The state posted ${plural(visits.length, 'visit')} with no problems cited.`
                    : 'The state posted no visits in the past 2 years.'}
                </Text>
              </View>
            ) : (
              findingVisits.map((v) => {
                // Highest-risk first. Two or more Low / Medium Low findings fold into one row.
                const sorted = [...v.findings].sort(byWeight);
                const lower = sorted.filter((f) => riskRank[f.risk_level] <= 2);
                const fold = lower.length >= 2;
                const shown = fold ? sorted.filter((f) => riskRank[f.risk_level] > 2) : sorted;
                return (
                  <View key={v.activity_id} style={{ gap: space.md }} onLayout={onVisitLayout(v.activity_id)}>
                    <View style={{ gap: space.xxs }}>
                      <Text variant="title" tabular>
                        {formatDate(v.date)}
                      </Text>
                      <Text variant="callout" tone="secondary">
                        {`${visitTypeLabel(v.type, v.selfReport)} · ${plural(v.findings.length, 'problem')}`}
                      </Text>
                    </View>
                    {shown.map((f) => (
                      <FindingCard key={f.non_compliance_id} finding={f} visitDate={v.date} onOfficial={onOfficial} />
                    ))}
                    {fold ? (
                      <Disclosure title={`${lower.length} less serious problems`}>
                        {lower.map((f) => (
                          <FindingCard key={f.non_compliance_id} finding={f} visitDate={v.date} onOfficial={onOfficial} />
                        ))}
                      </Disclosure>
                    ) : null}
                  </View>
                );
              })
            )
          ) : null}
          {tab === 'findings' && findingVisits.length > 0 && onCategories ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCategories}
              style={({ pressed }) => [styles.more, { gap: space.sm }, pressed && { opacity: 0.6 }]}
            >
              <Glyph name="info" size={15} color={c.textSecondary} weight="semibold" />
              <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                What the categories mean
              </Text>
              <Glyph name="chevronRight" size={13} color={c.textSecondary} weight="bold" />
            </Pressable>
          ) : null}
          {/* Said once under the list, not on every card. */}
          {tab === 'findings' && findingVisits.length > 0 ? (
            <Text variant="callout" tone="tertiary">
              Risk levels are the state’s.
            </Text>
          ) : null}

          {tab === 'rights' ? (
            <View>
              {lawCovers(daycare.operation_type) ? (
                <View style={[styles.cardTight, elevation.card, { backgroundColor: c.surface }]}>
                  {REQUEST_CARDS.map((r) => (
                    <RightCard key={r.kind} icon={r.icon} title={r.title} detail={r.detail} onPress={() => onRequest(r.kind)} />
                  ))}
                </View>
              ) : (
                <View style={[styles.empty, elevation.card, { backgroundColor: c.surface }]}>
                  <Text variant="subhead">{NOT_COVERED}</Text>
                  <Text variant="callout" tone="secondary">
                    You can still read every inspection the state posts here.
                  </Text>
                </View>
              )}
              <Text variant="callout" tone="tertiary" style={{ marginTop: space.lg }}>
                {lawCite}
              </Text>
            </View>
          ) : null}

          {footer}
        </Animated.View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.bar,
          {
            height: insets.top + 56,
            paddingTop: insets.top,
            backgroundColor: c.surface,
            borderBottomColor: c.hairline,
          },
          barStyle,
        ]}
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
        <Text variant="subhead" numberOfLines={1} color={hasPoint ? '#FFFFFF' : undefined} style={{ marginHorizontal: 64 }} align="center">
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
            <Text variant="subhead">Alerts need the app</Text>
            <Text variant="callout" tone="secondary">
              Watch a daycare in the phone app to get the state’s next post.
            </Text>
          </View>
        ) : (
          <Animated.View style={[{ flex: 1 }, popStyle]}>
            {watching ? (
              <Button
                label={alertsOn ? 'Watching · alerts on' : 'Watching · alerts off'}
                kind={alertsOn ? 'primary' : 'secondary'}
                icon={alertsOn ? 'bellFill' : 'bell'}
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
 * The page's one answer (hierarchy rule 1): what the state found at its most recent activity, as a sentence,
 * and one grey line on where the fixes stand. Only an inspection is a "visit": a report (a complaint the state looked
 * into, or one the daycare filed about itself) and an assessment are named as what they are.
 */
export function visitAnswer(last: Visit | undefined, today: string): { headline: string; sub: string | null } {
  // Non-breaking spaces keep "Oct 5" on one line when the sentence wraps.
  const when = last ? formatDateShort(last.date, today).replace(/ /g, '\u00A0') : '';
  const n = last?.findings.length ?? 0;
  const headline = !last
    ? 'No state visits in the past 2 years'
    : last.status === 'pending'
      ? `Results from the ${when} ${activityNoun(last) === 'own report' ? 'report' : activityNoun(last)} aren’t posted yet`
      : n > 0
        ? activityNoun(last) === 'own report'
          ? `${plural(n, 'problem')} in a report the daycare filed ${when}`
          : `${plural(n, 'problem')} found ${activityPhrase(last, when)}`
        : `No problems cited ${activityPhrase(last, when)}`;
  let sub: string | null = null;
  if (last && n > 0) {
    const open = latestOpen(last.findings);
    const openCount = last.findings.filter((f) => !isFixed(f)).length;
    // Never a bare "Fixed": say how it was fixed (at the visit, or checked by the state later).
    if (!open) sub = `${n === 1 ? '' : 'All '}${visitStatus(last, new Date(today))}`.replace(/^All F/, 'All f');
    else {
      // The last three words stay together, so a wrap never leaves "yet" alone at any text size.
      const short = shortStatus(open).replace(/(\w{3}) (\d)/g, '$1\u00A0$2');
      const status = open.corrected_date ? `${short} · no state check on\u00A0record\u00A0yet` : plainStatus(open);
      sub = openCount > 1 ? status.replace(/^Fix due/, 'Fixes due').replace(/^Fix date was/, 'Latest fix date was') : status;
      if (openCount < n) sub = `${n - openCount} fixed · ${sub}`;
    }
  }
  return { headline, sub };
}

function Answer({ last, today }: { last: Visit | undefined; today: string }) {
  const { headline, sub } = visitAnswer(last, today);
  // Read as two sentences: VoiceOver would otherwise join them with a comma ("visit, Fixes due") and may say the dot.
  const spoken = sub ? `${headline}. ${sub.replace(/ · /g, ', ')}.` : `${headline}.`;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={spoken} style={styles.answer}>
      <Text variant="largeTitle">{headline}</Text>
      {sub ? (
        <Text variant="callout" tone="secondary" tabular>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** The headline's status reduced to one finding's short status ("Fixes due Oct 30 · no state check…" → "Fix due Oct 30"). */
function headStatus(sub: string): string {
  return sub
    .replace(/^\d+ fixed · /, '')
    .split(' · no state check')[0]
    .replace(/^All f/, 'F')
    .replace(/^Fixes due/, 'Fix due')
    .replace(/^Latest fix date was/, 'Fix date was')
    .replace(/\u00A0/g, ' ');
}

/** The two problems a parent most needs, in the state's words, then the way to the rest. */
function TopProblems({
  items,
  total,
  today,
  onSeeAll,
  label,
  said,
}: {
  items: Finding[];
  total: number;
  today: string;
  /** What the headline above already says (its date and status), so a row never repeats it. */
  said?: { date: string; status: string | null } | null;
  onSeeAll: () => void;
  label: string | null;
}) {
  const c = useColors();
  return (
    <View style={[styles.top, { borderColor: c.hairline }, label ? styles.topLabelled : null]}>
      {label ? (
        <Text variant="callout" tone="secondary" style={styles.topLabel}>
          {label}
        </Text>
      ) : null}
      {items.map((f) => {
        const meta = [
          said && f.date === said.date ? null : formatDateShort(f.date, today),
          said?.status != null && headStatus(said.status) === shortStatus(f) ? null : shortStatus(f),
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View
            key={f.non_compliance_id}
            accessible
            accessibilityLabel={`${f.risk_level === 'High' ? 'Serious. ' : ''}${f.plain ?? ''} ${formatDate(f.date)}. ${shortStatus(f)}.`}
            style={[styles.topRow, { borderBottomColor: c.hairline }]}
          >
            {/* Every row leads with its category; "Serious" is an extra on High-risk rules only. */}
            <CategoryIcon category={f.category} size={36} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="subhead">{f.plain ?? 'The state did not publish a description.'}</Text>
              {/* The tag rides the meta line so the finding keeps the full width at every text size. */}
              {f.risk_level === 'High' || meta ? (
                <View style={styles.topMeta}>
                  {f.risk_level === 'High' ? <SeriousTag /> : null}
                  {meta ? (
                    <Text variant="callout" tone="secondary" tabular style={{ flexShrink: 1 }}>
                      {meta}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
      <Pressable accessibilityRole="button" onPress={onSeeAll} style={({ pressed }) => [styles.more, pressed && { opacity: 0.6 }]}>
        <Text variant="subhead" style={{ flex: 1 }}>
          {total > items.length ? `Past 2\u00A0years (${total})` : 'See the details'}
        </Text>
        <Glyph name="chevronRight" size={13} color={c.textSecondary} weight="bold" />
      </Pressable>
    </View>
  );
}

const PEERS: Record<string, string> = {
  'Licensed Center': 'centers',
  'Licensed Child-Care Home': 'licensed homes',
  'Registered Child-Care Home': 'registered homes',
  'Listed Family Home': 'listed family homes',
};

/** Past two years, one row per visit (Apple Weather's 10-day list): date, count, a bar, where it stands. */
function History({
  visits,
  today,
  area,
  onPress,
}: {
  visits: Visit[];
  today: string;
  area: AreaCompare | null | undefined;
  onPress: (id: number) => void;
}) {
  const c = useColors();
  // At the largest text sizes the date and the status no longer share a line: the date stacks on top, whole.
  const stack = useWindowDimensions().fontScale >= 1.6;
  const max = Math.max(1, ...visits.map((v) => v.findings.length));
  const median =
    area && area.peer_count >= 3
      ? Number.isInteger(area.median.findings)
        ? area.median.findings
        : Number(area.median.findings.toFixed(1))
      : null;
  return (
    <View style={[styles.card, elevation.card, { backgroundColor: c.surface, gap: space.sm }]}>
      <Text variant="title">Past 2 years</Text>
      {visits.length === 0 ? (
        <Text variant="callout" tone="secondary">
          The state posted no visits in the past 2 years.
        </Text>
      ) : (
        <View>
          {visits.map((v) => {
            const n = v.findings.length;
            const status = visitStatus(v);
            const date = (
              <Text variant="callout" tabular style={stack ? undefined : { flex: 1 }} numberOfLines={stack ? undefined : 1}>
                {formatDateShort(v.date, today)}
              </Text>
            );
            const count = (
              <Text variant="subhead" tabular style={styles.hCount} tone={n > 0 ? 'primary' : 'tertiary'}>
                {String(n)}
              </Text>
            );
            const bar = (
              <View style={[styles.hTrack, { backgroundColor: c.sunken }]}>
                {n > 0 ? <View style={[styles.hFill, { width: `${(n / max) * 100}%`, backgroundColor: c.text }]} /> : null}
              </View>
            );
            const word = (
              <Text
                variant="callout"
                tone="secondary"
                style={stack ? undefined : { textAlign: 'right', flexShrink: 1 }}
                numberOfLines={stack ? undefined : 2}
              >
                {status}
              </Text>
            );
            // Two lines per visit: date and where it stands, then the count and its bar. Room for the
            // full status words ("Fixed during the visit") at every text size, no truncation.
            const row = (
              <View style={{ flex: 1, gap: space.xs, paddingVertical: space.sm }}>
                <View style={stack ? { gap: space.xxs } : styles.hLine}>
                  {date}
                  {word}
                </View>
                <View style={styles.hLine}>
                  {count}
                  {bar}
                </View>
              </View>
            );
            const head = n === 0 ? 'no problems cited' : plural(n, 'problem');
            // A clean visit's status repeats the count ("No problems cited"), so VoiceOver says it once.
            const said = status.toLowerCase() === head ? '' : ` ${status.replace(/ · /g, ', ')}.`;
            const label = `${formatDate(v.date)}: ${head}.${said}`;
            return n > 0 ? (
              <Pressable
                key={v.activity_id}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint="Shows this visit's problems"
                onPress={() => onPress(v.activity_id)}
                style={({ pressed }) => [styles.hRow, { borderBottomColor: c.hairline }, pressed && { opacity: 0.6 }]}
              >
                {row}
              </Pressable>
            ) : (
              <View key={v.activity_id} accessible accessibilityLabel={label} style={[styles.hRow, { borderBottomColor: c.hairline }]}>
                {row}
              </View>
            );
          })}
        </View>
      )}
      {area && median != null ? (
        <Text variant="callout" tone="secondary" style={{ marginTop: space.xs }}>
          {`Typical for ${tidyCase(area.county)} County ${PEERS[area.operation_type] ?? 'daycares like this'}: ${plural(median, 'problem')} in ${
            area.window_months === 24 ? '2 years' : `${area.window_months} months`
          }.`}
        </Text>
      ) : null}
    </View>
  );
}

/** Tour questions built from this daycare's own findings (lib/tour). */
function TourCard({ questions, onOpen }: { questions: ReturnType<typeof buildTourQuestions>; onOpen: () => void }) {
  const c = useColors();
  if (questions.length === 0) return null;
  return (
    <View style={[styles.tour, elevation.card, { backgroundColor: c.surface }]}>
      <Text variant="title" accessibilityRole="header">
        Ask about these on your tour
      </Text>
      {questions.map((q, i) => (
        <View
          key={q.question}
          accessible
          accessibilityLabel={`${i + 1}. ${q.fact ? `${q.fact}. ` : ''}${q.question}`}
          style={styles.tourRow}
        >
          <View style={[styles.tourNum, { backgroundColor: c.text }]}>
            <Text variant="subhead" color={c.surface} tabular maxFontSizeMultiplier={1.2}>
              {String(i + 1)}
            </Text>
          </View>
          {/* The fact from the record leads; the one question it raises follows. */}
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text variant="subhead">{q.fact ?? q.question}</Text>
            {q.fact ? (
              <Text variant="callout" tone="secondary">
                {q.question}
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
        style={({ pressed }) => [
          styles.more,
          {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.hairline,
          },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text variant="subhead" style={{ flex: 1 }}>
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
  notes: {
    borderRadius: radius.card,
    padding: space.md,
    gap: space.xs,
    marginTop: space.xs,
  },
  answer: { gap: space.xs },
  // V4 surfaces: white cards on the grouped grey page.
  card: { borderRadius: radius.card + 4, padding: space.lg, marginTop: space.md },
  cardTight: { borderRadius: radius.card + 4, paddingHorizontal: space.lg, paddingVertical: space.xs },
  top: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  topLabelled: { borderTopWidth: 0 },
  topLabel: { paddingBottom: space.xs, paddingTop: space.sm },
  topMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingTop: space.xs,
  },
  tiles: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  body: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xxl },
  empty: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
  hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hCount: { minWidth: 22, textAlign: 'right' },
  hLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  hFill: { height: 8, borderRadius: 4 },
  tour: { borderRadius: radius.card, padding: space.lg, gap: space.lg },
  tourRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  tourNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: { backgroundColor: 'rgba(0,0,0,0.52)' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  floatTop: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
