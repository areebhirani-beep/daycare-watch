import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { useRise } from '@/components/ui/Celebration';
import { DaycareCard } from '@/components/ui/DaycareCard';
import { markOnboarded } from '@/components/ui/onboarding';
import { CardSkeleton } from '@/components/ui/Skeletons';
import { stripFromRecord } from '@/components/ui/strip';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { operationTypeLabel, tidyCase } from '@/lib/format';
import { useAlertsOn } from '@/lib/notifications';
import { haptic, space, useColors, useIsDark } from '@/theme';

/** After setup: the mark, "Watching", and the daycare's own card with its record, then the next step. */
export default function DoneScreen() {
  const c = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : null;
  const record = useDaycareRecord(id ?? 0);
  const d = id ? record.data?.daycare : undefined;
  // Only promise an alert when alerts really are on (permission granted and this phone registered).
  const alertsOn = useAlertsOn();
  // At the largest text sizes the picture gives up height so the name and record stay in view.
  const heroRatio = useWindowDimensions().fontScale >= 1.6 ? 3 : 2;
  const head = useRise(0);
  const card = useRise(120);
  const cta = useRise(240);

  useEffect(() => {
    if (id) haptic.success();
  }, [id]);

  const go = (toRecord: boolean) => {
    markOnboarded();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
    if (toRecord && id) router.push(`/daycare/${id}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + space.xl, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      {/* The welcome screen set light status text over its picture; this page is plain. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Scrolls when a long name at large text outgrows the screen. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <Animated.View style={[styles.copy, head]}>
          <AppMark width={48} />
          <Text variant="display" accessibilityRole="header">
            {id ? 'Watching' : 'You’re all set.'}
          </Text>
          <Text variant="body" tone="secondary">
            {!id
              ? 'Watch a daycare any time from its page.'
              : alertsOn
                ? 'We’ll tell you when the state posts something new about it.'
                : 'New state records will show in your Watching tab. Turn on alerts any time from its page.'}
          </Text>
        </Animated.View>
        {id ? (
          <Animated.View style={card}>
            {d && record.data ? (
              <DaycareCard
                width="100%"
                heroRatio={heroRatio}
                name={tidyCase(d.name)}
                meta={`${operationTypeLabel(d.operation_type)} · ${tidyCase(d.city)}`}
                lat={d.lat}
                lng={d.lng}
                operationType={d.operation_type}
                strip={stripFromRecord(record.data)}
                watched
                onPress={() => go(true)}
              />
            ) : (
              <CardSkeleton width="100%" heroRatio={heroRatio} />
            )}
          </Animated.View>
        ) : null}
      </ScrollView>
      <Animated.View style={[styles.actions, cta]}>
        {id ? (
          <>
            <Button label="See its record" kind="ink" onPress={() => go(true)} />
            <Button label="Explore the map" kind="plain" size="md" onPress={() => go(false)} />
          </>
        ) : (
          <Button label="Explore the map" kind="ink" onPress={() => go(false)} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.xl },
  copy: { gap: space.md, alignItems: 'flex-start' },
  actions: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm },
});
