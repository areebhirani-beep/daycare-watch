import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Celebration, useRise } from '@/components/ui/Celebration';
import { markOnboarded } from '@/components/ui/onboarding';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { space, useColors } from '@/theme';

/** The celebration after setup: the badge pops, marks burst, and the parent lands on the map or the record. */
export default function DoneScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : null;
  const record = useDaycareRecord(id ?? 0);
  const name = id && record.data ? tidyCase(record.data.daycare.name) : null;
  const text = useRise(260);
  const cta = useRise(420);

  const go = (toRecord: boolean) => {
    markOnboarded();
    router.dismissAll();
    router.replace('/');
    if (toRecord && id) router.push(`/daycare/${id}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <View style={styles.center}>
        <Celebration />
        <Animated.View style={[styles.copy, text]}>
          <Text variant="display" align="center" accessibilityRole="header">
            {id ? 'You’re watching.' : 'You’re all set.'}
          </Text>
          {name ? (
            <Text variant="title" tone="secondary" align="center" numberOfLines={2}>
              {name}
            </Text>
          ) : (
            <Text variant="callout" tone="secondary" align="center">
              Watch a daycare any time from its page.
            </Text>
          )}
        </Animated.View>
      </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  copy: { gap: space.sm, alignItems: 'center', marginTop: -space.xxl },
  actions: { paddingHorizontal: space.xl, gap: space.sm },
});
