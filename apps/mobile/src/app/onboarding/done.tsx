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

/** After setup: the badge fades in and its check draws once, then the name and the next step. */
export default function DoneScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : null;
  const record = useDaycareRecord(id ?? 0);
  const name = id && record.data ? tidyCase(record.data.daycare.name) : null;
  const text = useRise(400);
  const cta = useRise(480);

  const go = (toRecord: boolean) => {
    markOnboarded();
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
    if (toRecord && id) router.push(`/daycare/${id}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <View style={styles.center}>
        <Celebration />
        <Animated.View style={[styles.copy, text]}>
          <Text variant="display" align="center" accessibilityRole="header">
            {id ? (name ? `You’re watching ${name}.` : 'You’re watching.') : 'You’re all set.'}
          </Text>
          <Text variant="body" tone="secondary" align="center" style={{ maxWidth: 300 }}>
            {id ? 'We’ll tell you when the state posts something new.' : 'Watch a daycare any time from its page.'}
          </Text>
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
