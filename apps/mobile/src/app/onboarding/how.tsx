import { router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { SeriousTag, shortStatus } from '@/components/ui/FindingCard';
import { Glyph } from '@/components/ui/Glyph';
import { EXAMPLE_OPERATION_ID, pushBody } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { byWeight } from '@/components/ui/PlacePage';
import { Block } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { categoryLabel, formatDate, isFixed, splitStandard, stripBoilerplate, tidyCase } from '@/lib/format';
import { groupByVisit } from '@/lib/record';
import { easeOut, elevation, fade, haptic, motion, radius, space, useColors } from '@/theme';

const BEATS = [
  'Inspectors write down what they find.',
  'We put it in words any parent can follow.',
  'And tell you when the state posts something new.',
];

/**
 * A card that rises into place (one fade/rise), then steps back (washed, a touch smaller) each time a newer
 * card arrives. `depth` = how many cards sit in front of it.
 */
function Layer({ from = 16, depth = 0, children, style }: { from?: number; depth?: number; children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  const t = useSharedValue(0);
  const back = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: motion.slow, easing: easeOut, reduceMotion: ReduceMotion.System });
  }, [t]);
  useEffect(() => {
    back.value = withTiming(depth, { duration: motion.base, easing: easeOut, reduceMotion: ReduceMotion.System });
  }, [back, depth]);
  const s = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * from }, { scale: 1 - Math.min(back.value, 1) * 0.04 }],
  }));
  // Stepping back washes the card with the page colour instead of fading it, so cards never show through each other.
  // Two cards in front wash it out completely: a silhouette, so no half-line peeks out under the banner.
  const wash = useAnimatedStyle(() => ({ opacity: back.value <= 1 ? back.value * 0.55 : 0.55 + (back.value - 1) * 0.45 }));
  return (
    // A card that has stepped back is scenery: VoiceOver reads only the one in front.
    <Animated.View
      style={[s, style]}
      accessibilityElementsHidden={depth > 0}
      importantForAccessibility={depth > 0 ? 'no-hide-descendants' : 'auto'}
    >
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, borderRadius: radius.card + 4 }, wash]} />
    </Animated.View>
  );
}

/**
 * Step 2: how it works, in three taps, each one a real piece of the app on a real record (a licensed
 * center in Rockwall, unnamed): the inspector's words → the same finding in plain words with its
 * category and fix status → the push the pipeline sends, dropping in with a haptic.
 */
export default function HowScreen() {
  const c = useColors();
  const record = useDaycareRecord(EXAMPLE_OPERATION_ID);
  const [beat, setBeat] = useState(0);
  // The stage is a picture of the app: it scales with Dynamic Type up to 1.3x, then shows fewer rows.
  const big = useWindowDimensions().fontScale > 1.3;

  const ex = useMemo(() => {
    if (!record.data) return null;
    const visit = groupByVisit(record.data).find((v) => v.findings.length > 0);
    if (!visit) return null;
    const all = [...visit.findings].sort(byWeight);
    const f = all[0];
    if (!f) return null;
    // The raw record: every finding from that visit as the state lists it (rule, then the inspector's words).
    const raw = all.slice(0, big ? 2 : 3).map((x) => ({
      id: x.non_compliance_id,
      rule: splitStandard(x.standard),
      words: x.narrative?.trim() ? stripBoilerplate(x.narrative.trim()).replace(/\s+/g, ' ') : '',
    }));
    const words = f.narrative?.trim() ? stripBoilerplate(f.narrative.trim()) : (splitStandard(f.standard)?.title ?? '');
    return {
      f,
      raw,
      more: all.length - raw.length,
      words,
      rule: splitStandard(f.standard)?.number,
      date: formatDate(visit.date),
      city: tidyCase(record.data.daycare.city),
      push: pushBody(visit.findings.length, visit.date),
    };
  }, [record.data, big]);

  const next = () => {
    if (beat < BEATS.length - 1) {
      haptic.select();
      setBeat(beat + 1);
    } else router.push('/onboarding/find');
  };

  return (
    <OnboardingFrame
      step={2}
      scroll={false}
      actions={<Button label={beat < BEATS.length - 1 ? 'Next' : 'Find your daycare'} kind="ink" onPress={next} disabled={!ex} />}
    >
      <Animated.View key={beat} entering={fade()} style={styles.title}>
        <Text variant="largeTitle" accessibilityRole="header" accessibilityLiveRegion="polite">
          {BEATS[beat]}
        </Text>
      </Animated.View>

      <Pressable onPress={ex ? next : undefined} accessible={false} style={styles.stage}>
        {!ex ? (
          <View style={{ gap: space.md }}>
            <Block style={{ height: 196, borderRadius: radius.card }} />
            <Block style={{ height: 150, borderRadius: radius.card }} />
          </View>
        ) : (
          <>
            {/* a. The state's own record of that visit, as dense as the state publishes it. */}
            <Layer depth={beat}>
              <View
                accessible
                accessibilityLabel={[`State record, ${ex.city}, inspection ${ex.date}`, ...ex.raw.map((r) => [r.rule ? `Rule ${r.rule.number}, ${r.rule.title}` : '', r.words ?? ''].filter(Boolean).join('. '))].join('. ')}
                style={[styles.card, elevation.card, { backgroundColor: c.surface }]}
              >
                <View style={styles.row}>
                  <Glyph name="record" size={15} color={c.textSecondary} />
                  <Text maxFontSizeMultiplier={1.3} variant="footnote" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
                    {`State record · ${ex.city} · inspection ${ex.date}`}
                  </Text>
                </View>
                {ex.raw.map((r) => (
                  <View key={r.id} style={[styles.raw, { borderTopColor: c.hairline }]}>
                    {/* What the inspector wrote leads; the rule it falls under is the one meta line. */}
                    <Text maxFontSizeMultiplier={1.3} variant="subhead" numberOfLines={3}>
                      {r.words || r.rule?.title || ''}
                    </Text>
                    {r.rule ? (
                      <Text maxFontSizeMultiplier={1.3} variant="footnote" tone="secondary" tabular>
                        {`Rule ${r.rule.number}`}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {ex.more > 0 ? (
                  <Text maxFontSizeMultiplier={1.3} variant="footnote" tone="tertiary">{`+ ${ex.more} more`}</Text>
                ) : null}
              </View>
            </Layer>

            {/* b. The same finding, the way the app shows it. */}
            {beat >= 1 ? (
              <Layer depth={beat > 1 ? 1 : 0} style={styles.plain}>
                <View
                  accessible
                  accessibilityLabel={`${categoryLabel(ex.f.category)}. ${ex.f.risk_level === 'High' ? 'Serious. ' : ''}${(ex.f.plain ?? ex.words ?? '').replace(/[.\s]+$/, '')}. ${shortStatus(ex.f)}.`}
                  style={[styles.card, elevation.float, { backgroundColor: c.surface }]}
                >
                  <View style={styles.row}>
                    <CategoryIcon category={ex.f.category} size={40} />
                    <Text maxFontSizeMultiplier={1.3} variant="callout" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
                      {categoryLabel(ex.f.category)}
                    </Text>
                    {ex.f.risk_level === 'High' ? <SeriousTag /> : null}
                  </View>
                  <Text maxFontSizeMultiplier={1.3} variant="headline">{ex.f.plain ?? ex.words}</Text>
                  <View style={styles.row}>
                    <Glyph name={isFixed(ex.f) ? 'check' : 'clock'} size={14} color={c.textSecondary} weight="bold" />
                    <Text maxFontSizeMultiplier={1.3} variant="callout" tone="secondary" tabular style={{ flex: 1 }}>
                      {shortStatus(ex.f)}
                    </Text>
                  </View>
                </View>
              </Layer>
            ) : null}

            {/* c. The push, exactly as the pipeline words it. Labelled: it's an example, not a live alert. */}
            {beat >= 2 ? (
              <View style={styles.banner} pointerEvents="none">
                <AlertBanner title={`A licensed center in ${ex.city}`} body={ex.push} tag="Example" maxScale={1.3} />
              </View>
            ) : null}
          </>
        )}
      </Pressable>

      <View style={styles.dots} accessibilityElementsHidden>
        {BEATS.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= beat ? c.text : c.border, width: i === beat ? 20 : 8 }]} />
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  title: { minHeight: 64 },
  stage: { flex: 1, justifyContent: 'flex-start', paddingTop: space.sm, overflow: 'hidden' },
  raw: { gap: space.xs, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  plain: { marginTop: -space.xxxl * 2, marginHorizontal: space.xs },
  card: { borderRadius: radius.card + 4, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  banner: { position: 'absolute', top: -space.sm, left: -space.xs, right: -space.xs },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
