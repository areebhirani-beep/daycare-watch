import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Button } from '@/components/ui/Button';
import { visitAnswer } from '@/components/ui/PlacePage';
import { useDaycareRecord, useIsWatching, useSetWatch } from '@/lib/api';
import { tidyCase, todayIso } from '@/lib/format';
import { type EnableResult, enableAlerts, useAlertsOn } from '@/lib/notifications';
import { groupByVisit } from '@/lib/record';
import { isWeb } from '@/lib/runtime';
import type { DaycareRecord } from '@/lib/types';
import { haptic, radius, space, useColors } from '@/theme';

type Step = 'explain' | 'working' | 'done';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const operationId = Number(id);
  const c = useColors();
  const record = useDaycareRecord(operationId);
  const watching = useIsWatching(operationId);
  const setWatch = useSetWatch(operationId);
  const alertsOn = useAlertsOn();
  const [step, setStep] = useState<Step>('explain');
  const [result, setResult] = useState<EnableResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = tidyCase(record.data?.daycare.name) || 'this daycare';

  async function turnOn() {
    setStep('working');
    setError(null);
    try {
      await setWatch.mutateAsync(true);
      haptic.success();
      setResult(await enableAlerts().catch(() => ({ permission: 'undetermined' as const, registered: false })));
      setStep('done');
    } catch {
      setError('We couldn’t save this right now. Check your connection and try again.');
      setStep('explain');
    }
  }

  // 'Not now' answers the alerts question, not the watch: the parent asked to watch, so watch without alerts.
  // The place button then reads 'Watching · alerts off' and the Watching tab lists it.
  async function watchQuietly() {
    setStep('working');
    setError(null);
    try {
      await setWatch.mutateAsync(true);
      haptic.select();
      router.back();
    } catch {
      setError('We couldn’t save this right now. Check your connection and try again.');
      setStep('explain');
    }
  }

  if (watching && step === 'explain') {
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        <T variant="title" accessibilityRole="header">
          You&rsquo;re watching {name}
        </T>
        <LastVisit record={record.data} />
        <T variant="body" tone="secondary">
          {alertsOn
            ? 'We’ll alert you when the state posts a new problem, a permit change, or corrective action.'
            : 'Notifications are off for this app, so alerts can’t reach this phone. New state records still show in the Watching tab.'}
        </T>
        <View style={styles.buttons}>
          <Button label="Done" onPress={() => router.back()} />
          {!alertsOn && !isWeb ? (
            <Button label="Open Settings" kind="plain" onPress={() => void Linking.openSettings()} />
          ) : null}
          <Button
            label="Stop watching"
            kind="plain"
            onPress={() => {
              void setWatch.mutateAsync(false).then(() => router.back());
            }}
          />
        </View>
      </ScrollView>
    );
  }

  if (step === 'done') {
    const on = result?.permission === 'granted' && result.registered;
    const blocked = result?.permission === 'denied';
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        <T variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
          You&rsquo;re watching {name}
        </T>
        <LastVisit record={record.data} />
        <T variant="body" tone="secondary">
          {on
            ? 'Alerts are on. The next time the state posts something about this daycare, you’ll get one notification.'
            : blocked
              ? 'Notifications are off for this app, so we can’t send alerts. New state records will still show in the Watching tab.'
              : 'This phone couldn’t sign up for alerts yet. New state records will still show in the Watching tab.'}
        </T>
        <View style={styles.buttons}>
          <Button label="Done" onPress={() => router.back()} />
          {blocked ? <Button label="Open Settings" kind="plain" onPress={() => void Linking.openSettings()} /> : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <T variant="title" accessibilityRole="header">
        Get told when the state posts something new about {name}
      </T>

      <View style={styles.points}>
        <Point title="What you'll get">
          One alert when Texas posts a new finding, a permit change, corrective or adverse action, or a closure here.
        </Point>
        <Point title="When">
          Once the state publishes what it found. Not when an investigation opens.
        </Point>
      </View>

      <T variant="footnote" tone="secondary">
        Next, your phone asks about notifications. Tap Allow so alerts reach you.
      </T>
      {error ? (
        <T variant="callout" color={c.risk.High} accessibilityLiveRegion="assertive">
          {error}
        </T>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label={step === 'working' ? 'Turning on…' : 'Turn on alerts'}
          kind="ink"
          icon="bell"
          disabled={step === 'working'}
          onPress={() => void turnOn()}
        />
        <Button label="Not now" kind="plain" disabled={step === 'working'} onPress={() => void watchQuietly()} />
      </View>
    </ScrollView>
  );
}

/** The same answer the place page leads with, from the state's most recent visit in the past 2 years. */
function LastVisit({ record }: { record: DaycareRecord | undefined }) {
  const c = useColors();
  if (!record) return null;
  const today = todayIso();
  const cutoff = `${Number(today.slice(0, 4)) - 2}${today.slice(4)}`;
  const { headline, sub } = visitAnswer(
    groupByVisit(record).find((v) => v.date >= cutoff),
    today,
  );
  return (
    <View style={[styles.answer, { backgroundColor: c.sunken }]} accessible>
      <T variant="headline">{headline}</T>
      {sub ? (
        <T variant="callout" tone="secondary">
          {sub}
        </T>
      ) : null}
    </View>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xxs }}>
      <T variant="headline">{title}</T>
      <T variant="callout" tone="secondary">
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.section },
  points: { gap: space.lg, paddingVertical: space.sm },
  buttons: { gap: space.sm, marginTop: space.sm },
  answer: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
});
