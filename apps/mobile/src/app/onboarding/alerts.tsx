import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { EXAMPLE_OPERATION_ID } from '@/components/ui/onboarding';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { Block } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { formatDateShort, tidyCase } from '@/lib/format';
import { enableAlerts } from '@/lib/notifications';
import { groupByVisit } from '@/lib/record';
import { radius, space, useColors } from '@/theme';

const icon = require('../../../assets/images/icon.png') as number;

export default function AlertsScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ id?: string }>();
  const watchedId = params.id ? Number(params.id) : null;
  const record = useDaycareRecord(watchedId ?? EXAMPLE_OPERATION_ID);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  // The alert this daycare's most recent posted visit would have sent, in the agreed push copy.
  const example = useMemo(() => {
    if (!record.data) return null;
    const visit = groupByVisit(record.data).find((v) => v.findings.length > 0);
    if (!visit) return null;
    const n = visit.findings.length;
    return {
      title: watchedId ? tidyCase(record.data.daycare.name) : 'A licensed center in Rockwall',
      body: `The state posted ${n === 1 ? 'a new finding' : `${n} new findings`} from a visit on ${formatDateShort(visit.date)}. Tap to read what inspectors wrote.`,
    };
  }, [record.data, watchedId]);

  const finish = () =>
    router.replace({ pathname: '/onboarding/done', params: watchedId ? { id: String(watchedId) } : {} });

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
      step={3}
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
      <Text variant="display" accessibilityRole="header">
        Know the day the state posts something new.
      </Text>

      {example ? (
        <Animated.View
          entering={FadeInDown.springify().damping(16).reduceMotion(ReduceMotion.System)}
          style={[styles.banner, { backgroundColor: c.sunken }]}
          accessible
          accessibilityLabel={`Example alert. ${example.title}. ${example.body}`}
        >
          <Image source={icon} style={styles.icon} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.bannerTop}>
              <Text variant="subhead" numberOfLines={1} style={{ flex: 1 }}>
                {example.title}
              </Text>
              <Text variant="caption" tone="tertiary">
                Example
              </Text>
            </View>
            <Text variant="callout" tone="secondary">
              {example.body}
            </Text>
          </View>
        </Animated.View>
      ) : record.isPending ? (
        <Block style={{ height: 92, borderRadius: 22 }} />
      ) : null}

      <View style={{ gap: space.md }}>
        <Point>Only new findings, permit changes, or closures</Point>
        <Point>Only for daycares you watch</Point>
        <Point>Posted after the state’s review, often weeks after a visit</Point>
      </View>
    </OnboardingFrame>
  );
}

function Point({ children }: { children: string }) {
  const c = useColors();
  return (
    <View style={styles.point}>
      <View style={[styles.check, { backgroundColor: c.accentSoft }]}>
        <Glyph name="check" size={12} color={c.accent} weight="heavy" />
      </View>
      <Text variant="callout" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 22, padding: space.md, flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: { width: 38, height: 38, borderRadius: 9 },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', minHeight: 28 },
  check: { marginTop: -1, width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
