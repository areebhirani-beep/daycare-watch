import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { FlyoverHero, flyoverAllowed } from '@/components/ui/FlyoverHero';
import { EXAMPLE_OPERATION_ID, pushBody } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { Block } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase, todayIso } from '@/lib/format';
import { enableAlerts } from '@/lib/notifications';
import { groupByVisit } from '@/lib/record';
import { radius, space } from '@/theme';

// Within about six months: recent enough that an alert about it reads as news.
const RECENT_DAYS = 183;
function recent(day: string | null): boolean {
  if (!day) return false;
  return (Date.parse(todayIso()) - Date.parse(day)) / 86_400_000 <= RECENT_DAYS;
}

// The lock screen is an illustration, so it shows Apple's 9:41 with today's date.
function useClock() {
  return {
    time: '9:41',
    day: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
}

/**
 * Step 4: alerts. A lock screen (9:41, the watched daycare's 3D view as wallpaper when it's a
 * center with an exact address, plain ink otherwise) and the push the pipeline would send for its
 * latest posted visit, dropping in. One line, then the OS prompt.
 */
export default function AlertsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const watchedId = params.id ? Number(params.id) : null;
  const record = useDaycareRecord(watchedId ?? EXAMPLE_OPERATION_ID);
  // A watched daycare whose latest problems are old would make a "new" alert out of a years-old visit, so the
  // example falls back to the reference center's latest visit (a real one, labelled as an example).
  const fallback = useDaycareRecord(EXAMPLE_OPERATION_ID);
  const clock = useClock();
  const { height } = useWindowDimensions();
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const d = record.data?.daycare;
  const example = useMemo(() => {
    const own = record.data ? groupByVisit(record.data).find((v) => v.findings.length > 0) : undefined;
    if (watchedId && record.data && own && recent(own.date)) {
      return { title: tidyCase(record.data.daycare.name), body: pushBody(own.findings.length, own.date) };
    }
    const ref = fallback.data;
    const visit = ref ? groupByVisit(ref).find((v) => v.findings.length > 0) : undefined;
    if (!ref || !visit) return null;
    return { title: `A center in ${tidyCase(ref.daycare.city)}`, body: pushBody(visit.findings.length, visit.date) };
  }, [record.data, fallback.data, watchedId]);

  const finish = () => router.replace({ pathname: '/onboarding/done', params: watchedId ? { id: String(watchedId) } : {} });

  const turnOn = async () => {
    setBusy(true);
    try {
      const result = await enableAlerts();
      if (result.permission === 'granted') finish();
      else setDenied(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingFrame
      step={4}
      actions={
        denied ? (
          <>
            <Text variant="footnote" tone="secondary" align="center">
              Alerts are off. You can turn them on in Settings.
            </Text>
            <Button label="Continue" kind="ink" onPress={finish} />
          </>
        ) : (
          <>
            <Button label="Turn on alerts" kind="primary" icon="bellFill" disabled={busy} onPress={() => void turnOn()} />
            <Button label="Not now" kind="plain" size="md" onPress={finish} />
          </>
        )
      }
    >
      <View style={{ gap: space.sm }}>
        <Text variant="display" accessibilityRole="header">
          Turn on alerts.
        </Text>
        <Text variant="body" tone="secondary">
          Only for daycares you watch, and only when the state posts something new.
        </Text>
      </View>

      <View style={[styles.phone, { height: Math.max(340, height * 0.46) }]} accessible={false}>
        {flyoverAllowed(d) ? <FlyoverHero lat={d?.lat} lng={d?.lng} /> : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.38)' }]} />
        <View style={styles.clock} accessibilityElementsHidden>
          <Text variant="headline" color="rgba(255,255,255,0.86)" maxFontSizeMultiplier={1.3}>
            {clock.day}
          </Text>
          <Text color="#FFFFFF" style={styles.time} tabular maxFontSizeMultiplier={1}>
            {clock.time}
          </Text>
        </View>
        <View style={styles.bannerSlot}>
          {example ? (
            <AlertBanner title={example.title} body={example.body} tag="Example" delay={400} maxScale={1.3} />
          ) : record.isPending || fallback.isPending ? (
            <Block style={{ height: 96, borderRadius: 24 }} />
          ) : null}
        </View>
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  phone: { borderRadius: radius.sheet + 4, overflow: 'hidden', backgroundColor: '#0B0B0C' },
  clock: { alignItems: 'center', paddingTop: space.xxl },
  time: { fontSize: 76, lineHeight: 84, fontWeight: '700', letterSpacing: -2 },
  bannerSlot: { paddingHorizontal: space.md, paddingTop: space.xl },
});
