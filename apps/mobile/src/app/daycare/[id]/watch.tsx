import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { Button } from '@/components/ui';
import { useDaycareRecord, useIsWatching, useSetWatch } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { enableAlerts, type PermissionState } from '@/lib/notifications';
import { space, useColors } from '@/theme';

type Step = 'explain' | 'working' | 'done';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const operationId = Number(id);
  const c = useColors();
  const record = useDaycareRecord(operationId);
  const watching = useIsWatching(operationId);
  const setWatch = useSetWatch(operationId);
  const [step, setStep] = useState<Step>('explain');
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = tidyCase(record.data?.daycare.name) || 'this daycare';

  async function turnOn() {
    setStep('working');
    setError(null);
    try {
      await setWatch.mutateAsync(true);
      try {
        setPermission(await enableAlerts());
      } catch {
        // Watching still works without a push token; the Watching tab shows new records.
        setPermission('denied');
      }
      setStep('done');
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
        <T variant="body" tone="secondary">
          We&rsquo;ll alert you when the state posts a new finding, a permit change, or corrective action.
        </T>
        <View style={styles.buttons}>
          <Button label="Done" onPress={() => router.back()} />
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
    const on = permission === 'granted';
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        <T variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
          You&rsquo;re watching {name}
        </T>
        <T variant="body" tone="secondary">
          {on
            ? 'Alerts are on. The next time the state posts something about this daycare, you’ll get one notification.'
            : 'Notifications are off for this app, so we can’t send alerts. New state records will still show in the Watching tab.'}
        </T>
        <View style={styles.buttons}>
          <Button label="Done" onPress={() => router.back()} />
          {!on ? <Button label="Open Settings" kind="plain" onPress={() => void Linking.openSettings()} /> : null}
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
          One alert when Texas posts a new inspection finding, a permit status change, corrective or adverse action, or a temporary closure at this daycare.
        </Point>
        <Point title="How often">
          The state visits each daycare every 2 to 8 months, so most families get only a few alerts a year.
        </Point>
        <Point title="When">
          After the state posts it, usually a week or more after the visit. We can&rsquo;t alert you when an investigation opens, only once the state publishes what it found.
        </Point>
        <Point title="What we keep">
          No account, name, or location. Just which daycares this phone watches.
        </Point>
      </View>

      <T variant="footnote" tone="secondary">
        Next, your phone will ask to allow notifications. Choose Allow so alerts can reach you.
      </T>
      {error ? (
        <T variant="callout" color={c.risk.High} accessibilityLiveRegion="assertive">
          {error}
        </T>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label={step === 'working' ? 'Turning on…' : 'Turn on alerts'}
          icon="bell"
          disabled={step === 'working'}
          onPress={() => void turnOn()}
        />
        <Button label="Not now" kind="plain" onPress={() => router.back()} />
      </View>
    </ScrollView>
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
});
