import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { FlyoverHero } from '@/components/ui/FlyoverHero';
import { EXAMPLE_OPERATION_ID } from '@/components/ui/onboarding';
import { OnboardingTop } from '@/components/ui/OnboardingFrame';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { enter, fade, space } from '@/theme';

// A stepped scrim (no gradient library): darker toward the bottom so white type clears AA on any roof.
const SCRIM = [0, 0.05, 0.12, 0.22, 0.34, 0.47, 0.6, 0.7, 0.77, 0.8];
const TOP = [0.42, 0.3, 0.18, 0.08, 0];

const rise = enter;

/**
 * Step 1, the hook: a real licensed center in TX-04, in Apple's 3D flyover, turning slowly. One line,
 * one button. No numbers. The place is named by type and city only, never by name.
 */
export default function HookScreen() {
  const insets = useSafeAreaInsets();
  const record = useDaycareRecord(EXAMPLE_OPERATION_ID);
  const d = record.data?.daycare;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View entering={fade(300)} style={StyleSheet.absoluteFill}>
        <FlyoverHero lat={d?.lat} lng={d?.lng} legalTop={insets.top + 56} />
      </Animated.View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.12)' }]} />
      <View pointerEvents="none" style={styles.scrim}>
        {SCRIM.map((a, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${a})` }} />
        ))}
      </View>

      <View pointerEvents="none" style={[styles.top, { height: insets.top + 96 }]}>
        {TOP.map((a, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${a})` }} />
        ))}
      </View>

      <View style={{ paddingTop: insets.top + space.xs }}>
        <OnboardingTop step={1} onImage />
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Animated.View entering={rise(0)} style={styles.lockup}>
          <AppMark width={44} color="#FFFFFF" background="transparent" />
          <Text variant="headline" color="#FFFFFF">
            Daycare Watch
          </Text>
        </Animated.View>
        <Animated.View entering={rise(1)}>
          <Text variant="display" color="#FFFFFF" accessibilityRole="header" style={styles.shadow}>
            Know what Texas inspectors found before you pick a daycare.
          </Text>
        </Animated.View>
        <Animated.View entering={rise(2)} style={{ gap: space.lg }}>
          <Text variant="footnote" color="rgba(255,255,255,0.78)" numberOfLines={1}>
            {d ? `A licensed center in ${tidyCase(d.city)}, TX${Platform.OS === 'ios' ? ' · 3D view, Apple Maps' : ''}` : ' '}
          </Text>
          <Button label="Get started" kind="onImage" onPress={() => router.push('/onboarding/how')} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0C', justifyContent: 'space-between' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottom: { paddingHorizontal: space.xl, gap: space.lg },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  shadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } },
});
