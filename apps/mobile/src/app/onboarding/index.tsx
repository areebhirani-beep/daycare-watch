import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { shortStatus } from '@/components/ui/FindingCard';
import { EXAMPLE_OPERATION_ID, markOnboarded } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { byWeight, visitAnswer } from '@/components/ui/PlacePage';
import { Block } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { formatDateShort, tidyCase } from '@/lib/format';
import { groupByVisit } from '@/lib/record';
import { radius, space, useColors } from '@/theme';

// Point-in-polygon count against the CD119 boundary (CONTRACT 3, decision log Oct 24 6:25 pm).
// Always "at least": daycares without a map point are not counted.
const TX04_DAYCARES_AT_LEAST = 379;

const rise = (i: number) => FadeInDown.delay(120 + i * 90).duration(360).reduceMotion(ReduceMotion.System);

/**
 * Step 1: what the app does for a parent, shown on one real daycare's record. Three sizes: 34 (the
 * promise), 17 (the example and the lockup), 15 (grey meta).
 */
export default function WhyScreen() {
  const c = useColors();
  const record = useDaycareRecord(EXAMPLE_OPERATION_ID);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const example = useMemo(() => {
    if (!record.data) return null;
    const cutoff = new Date(new Date(today).getFullYear() - 2, new Date(today).getMonth(), 1).toISOString().slice(0, 10);
    const visits = groupByVisit(record.data).filter((v) => v.date >= cutoff);
    const last = visits[0];
    const top = last ? [...last.findings].sort(byWeight)[0] : undefined;
    return { answer: visitAnswer(last, today), top, name: tidyCase(record.data.daycare.name), city: tidyCase(record.data.daycare.city) };
  }, [record.data, today]);

  return (
    <OnboardingFrame
      step={1}
      onClose={() => {
        markOnboarded();
        router.replace('/');
      }}
      actions={<Button label="Find your daycare" kind="ink" onPress={() => router.push('/onboarding/find')} />}
    >
      <Animated.View entering={rise(0)} style={{ gap: space.xl }}>
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
        <Text variant="callout" tone="secondary">
          {example ? `A real example: ${example.name}, ${example.city}` : 'A real example from the state record'}
        </Text>
        {example ? (
          <>
            <Text variant="headline">{example.answer.headline}</Text>
            {example.top?.plain ? <Text variant="body">{`“${example.top.plain}”`}</Text> : null}
            {example.top ? (
              <Text variant="callout" tone="secondary" tabular>
                {`${formatDateShort(example.top.date, today)} · ${shortStatus(example.top)}`}
              </Text>
            ) : null}
          </>
        ) : (
          <View style={{ gap: space.sm }}>
            <Block style={{ height: 22, width: '80%' }} />
            <Block style={{ height: 20, width: '95%' }} />
            <Block style={{ height: 18, width: '40%' }} />
          </View>
        )}
      </Animated.View>

      <Animated.View entering={rise(2)}>
        <Text variant="callout" tone="secondary" tabular>
          {`Covers at least ${TX04_DAYCARES_AT_LEAST} daycares in Texas’s 4th District, straight from data.texas.gov.`}
        </Text>
      </Animated.View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
