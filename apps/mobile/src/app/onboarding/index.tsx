import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { EXAMPLE_OPERATION_ID, markOnboarded } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { RecordStrip, StripSkeleton, type StripVisit, stripFromRecord } from '@/components/ui/RecordStrip';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { radius, space, useColors } from '@/theme';

// Point-in-polygon count against the CD119 boundary (CONTRACT 3, decision log Oct 24 6:25 pm).
// Always "at least": daycares without a map point are not counted.
const TX04_DAYCARES_AT_LEAST = 379;

function within(visits: StripVisit[], months: number, now = new Date()): StripVisit[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).toISOString().slice(0, 10);
  return visits.filter((v) => v.date >= cutoff);
}

const rise = (i: number) => FadeInDown.delay(120 + i * 90).duration(360).reduceMotion(ReduceMotion.System);

export default function WhyScreen() {
  const c = useColors();
  const record = useDaycareRecord(EXAMPLE_OPERATION_ID);
  const visits = useMemo(() => (record.data ? within(stripFromRecord(record.data), 24) : []), [record.data]);
  const city = record.data?.daycare.city ? tidyCase(record.data.daycare.city) : 'Rockwall';

  return (
    <OnboardingFrame
      step={1}
      onClose={() => {
        markOnboarded();
        router.replace('/');
      }}
      actions={<Button label="Find your daycare" kind="ink" onPress={() => router.push('/onboarding/find')} />}
    >
      <Animated.View entering={rise(0)} style={{ gap: space.lg }}>
        <View style={styles.lockup}>
          <AppMark width={52} />
          <Text variant="headline">Daycare Watch</Text>
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="display" accessibilityRole="header">
            See what Texas inspectors found at your daycare.
          </Text>
          <Text variant="body" tone="secondary">
            Plain words from the state record, and an alert when the state posts something new.
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={rise(1)} style={[styles.card, { backgroundColor: c.sunken }]}>
        <Text variant="footnote" tone="secondary">
          Daycares in Texas’s 4th District
        </Text>
        <View style={styles.numeralRow}>
          <Text variant="footnote" tone="secondary" style={styles.atLeast}>
            at least
          </Text>
          <Text variant="numeral" accessibilityLabel={`At least ${TX04_DAYCARES_AT_LEAST}`}>
            {String(TX04_DAYCARES_AT_LEAST)}
          </Text>
        </View>
        <Text variant="footnote" tone="tertiary">
          Each one is inspected by the state every few months.
        </Text>
      </Animated.View>

      <Animated.View entering={rise(2)} style={[styles.card, { backgroundColor: c.sunken }]}>
        <Text variant="footnote" tone="secondary">
          {`A licensed center in ${city} · last 24 months`}
        </Text>
        <View style={{ marginTop: space.md }}>
          {record.data ? <RecordStrip visits={visits} variant="hero" /> : <StripSkeleton />}
        </View>
      </Animated.View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.stat, padding: space.lg, gap: space.xs },
  numeralRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  atLeast: { paddingBottom: 10 },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
