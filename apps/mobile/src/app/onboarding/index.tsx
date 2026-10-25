import { router } from 'expo-router';
import { type ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { T } from '@/components/T';
import { Button } from '@/components/ui';
import { EXAMPLE_OPERATION_ID, markOnboarded } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { RecordStrip, StripSkeleton, type StripVisit, stripFromRecord } from '@/components/ui/RecordStrip';
import { Serif } from '@/components/ui/Serif';
import { useDaycareRecord } from '@/lib/api';
import { formatDate, plural } from '@/lib/format';
import { motion, space, useColors } from '@/theme';

function within(visits: StripVisit[], months: number, now = new Date()): StripVisit[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).toISOString().slice(0, 10);
  return visits.filter((v) => v.date >= cutoff);
}

export default function WhyScreen() {
  const c = useColors();
  const record = useDaycareRecord(EXAMPLE_OPERATION_ID);
  const visits = useMemo(() => (record.data ? within(stripFromRecord(record.data), 24) : []), [record.data]);

  const latest = visits.filter((v) => v.marks.length > 0).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const open = visits.reduce((n, v) => n + v.marks.filter((m) => m.open).length, 0);
  const quiet = visits.filter((v) => v.marks.length === 0).length;
  const city = record.data?.daycare.city ? tidy(record.data.daycare.city) : null;

  return (
    <OnboardingFrame
      step={1}
      onSkip={() => {
        markOnboarded();
        router.replace('/');
      }}
      actions={<Button label="Find your daycare" onPress={() => router.push('/onboarding/find')} />}
    >
      <View style={{ gap: space.md }}>
        <Serif variant="display" accessibilityRole="header">
          Texas inspects daycares every few months.
        </Serif>
        <T variant="body" tone="secondary">
          What inspectors find is public, but it sits on a state website in rule numbers and shorthand. This app
          puts it in plain English, and tells you when something new is posted.
        </T>
      </View>

      <View style={[styles.figure, { borderTopColor: c.text }]}>
        <T variant="footnote" tone="secondary">
          {city ? `A licensed center in ${city}, last 24 months` : 'A licensed center, last 24 months'}
        </T>
        {record.data ? (
          <Animated.View entering={FadeIn.duration(motion.base).reduceMotion(ReduceMotion.System)}>
            <RecordStrip visits={visits} variant="hero" showKey={false} />
          </Animated.View>
        ) : (
          <StripSkeleton />
        )}

        {record.data ? (
          <View style={styles.legend}>
            {latest ? (
              <LegendRow glyph={<StackGlyph visit={latest} />}>
                {`${formatDate(latest.date)}: ${plural(latest.marks.length, 'finding')} from one visit, stacked by how serious the rule is`}
              </LegendRow>
            ) : null}
            {open > 0 ? (
              <LegendRow glyph={<Outline />}>{`${plural(open, 'finding')} not yet verified by the state`}</LegendRow>
            ) : null}
            {quiet > 0 ? (
              <LegendRow glyph={<Dot />}>{`${plural(quiet, 'visit')} with no findings posted`}</LegendRow>
            ) : null}
          </View>
        ) : null}
      </View>

      <T variant="footnote" tone="tertiary">
        Every mark is a real record from Texas Health and Human Services. Nothing here is a grade.
      </T>
    </OnboardingFrame>
  );
}

function tidy(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function LegendRow({ glyph, children }: { glyph: ReactNode; children: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.glyph}>{glyph}</View>
      <T variant="callout" style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

/** The latest visit's own marks, drawn small, so the key points at real data. */
function StackGlyph({ visit }: { visit: StripVisit }) {
  const c = useColors();
  return (
    <View style={{ gap: 2, flexDirection: 'column-reverse' }}>
      {visit.marks.slice(0, 4).map((m, i) => {
        const tint = c.risk[LEVEL[m.rank]];
        return (
          <View
            key={i}
            style={[styles.mark, m.open ? { borderWidth: 1.5, borderColor: tint } : { backgroundColor: tint }]}
          />
        );
      })}
    </View>
  );
}

const LEVEL = { 5: 'High', 4: 'Medium High', 3: 'Medium', 2: 'Medium Low', 1: 'Low' } as const;

function Outline() {
  const c = useColors();
  return <View style={[styles.mark, { borderWidth: 1.5, borderColor: c.textSecondary }]} />;
}

function Dot() {
  const c = useColors();
  return <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.textTertiary }} />;
}

const styles = StyleSheet.create({
  figure: { borderTopWidth: 1.5, paddingTop: space.md, gap: space.lg },
  legend: { gap: space.md },
  legendRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  glyph: { width: 16, minHeight: 21, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  mark: { width: 8, height: 7, borderRadius: 1.5 },
});
