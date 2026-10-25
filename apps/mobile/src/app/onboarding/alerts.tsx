import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';

import { SkeletonBlock } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button } from '@/components/ui';
import { EXAMPLE_OPERATION_ID, markOnboarded } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { Serif } from '@/components/ui/Serif';
import { useDaycareRecord } from '@/lib/api';
import { enableAlerts } from '@/lib/notifications';
import { groupByVisit } from '@/lib/record';
import { formatDateShort } from '@/lib/format';
import { motion, radius, space, useColors } from '@/theme';

const icon = require('../../../assets/images/icon.png') as number;

export default function AlertsScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ id?: string }>();
  const watchedId = params.id ? Number(params.id) : null;
  const record = useDaycareRecord(watchedId ?? EXAMPLE_OPERATION_ID);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  // The alert this daycare's most recent posted visit would have sent, in the agreed copy (DESIGN.md 4).
  const example = useMemo(() => {
    if (!record.data) return null;
    const visit = groupByVisit(record.data).find((v) => v.findings.length > 0);
    if (!visit) return null;
    const n = visit.findings.length;
    return {
      title: watchedId ? record.data.daycare.name : 'A licensed center in Rockwall',
      body: `The state posted ${n === 1 ? 'a new finding' : `${n} new findings`} from a visit on ${formatDateShort(visit.date)}. Tap to read what inspectors wrote.`,
    };
  }, [record.data, watchedId]);

  const finish = () => {
    markOnboarded();
    router.dismissAll();
    router.replace('/');
    if (watchedId) router.push(`/daycare/${watchedId}`);
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await enableAlerts();
      if (result.permission === 'granted') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        finish();
      } else {
        setDenied(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingFrame
      step={3}
      actions={
        denied ? (
          <>
            <T variant="footnote" tone="secondary" align="center">
              Alerts are off. You can turn them on later in Settings.
            </T>
            <Button label="Continue" onPress={finish} />
          </>
        ) : (
          <>
            <Button label="Turn on alerts" disabled={busy} onPress={() => void turnOn()} />
            <Button label="Not now" kind="plain" onPress={finish} />
          </>
        )
      }
    >
      <View style={{ gap: space.md }}>
        <Serif variant="display" accessibilityRole="header">
          Know when the state posts something new.
        </Serif>
        <T variant="body" tone="secondary">
          {watchedId
            ? 'This is how its last visit with findings would read as an alert.'
            : 'Here is what an alert looks like, using a real visit.'}
        </T>
      </View>

      {example ? (
        <Animated.View
          entering={FadeInUp.duration(motion.slow).reduceMotion(ReduceMotion.System)}
          style={[styles.banner, { backgroundColor: c.surface, borderColor: c.border }]}
          accessible
          accessibilityLabel={`Example alert. ${example.title}. ${example.body}`}
        >
          <View style={styles.bannerTop}>
            <Image source={icon} style={styles.icon} />
            <T variant="caption" tone="secondary" style={{ flex: 1 }}>
              Daycare Watch
            </T>
            <T variant="caption" tone="tertiary">
              Example
            </T>
          </View>
          <T variant="headline" numberOfLines={1}>
            {example.title}
          </T>
          <T variant="callout">{example.body}</T>
        </Animated.View>
      ) : record.isPending ? (
        <SkeletonBlock height={112} />
      ) : (
        <T variant="callout" tone="secondary">
          The state has no findings posted for this daycare yet. If it posts one, this is where you would hear.
        </T>
      )}

      <View style={{ gap: space.md }}>
        <Point>Only when Texas posts a new finding, a permit change, or a closure for a daycare you watch.</Point>
        <Point>Nothing else. No ads, no reminders, no tips.</Point>
        <Point>
          The state posts findings after its review, so an alert can come days or weeks after the visit.
        </Point>
      </View>

      <T variant="footnote" tone="tertiary">
        {`Each daycare’s page on the state site also offers email updates. This puts them on your phone, in plain English. Your phone will ask for permission next.`}
      </T>
    </OnboardingFrame>
  );
}

function Point({ children }: { children: string }) {
  const c = useColors();
  return (
    <View style={styles.point}>
      <View style={[styles.bullet, { backgroundColor: c.text }]} />
      <T variant="callout" style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.md, gap: space.xxs },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  icon: { width: 20, height: 20, borderRadius: 5 },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 1, marginTop: 8 },
});
