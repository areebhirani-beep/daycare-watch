import { router } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMark } from '@/components/ui/AppMark';
import { Button } from '@/components/ui/Button';
import { FlyoverHero } from '@/components/ui/FlyoverHero';
import { WELCOME_OPERATION_ID } from '@/components/ui/onboarding';
import { OnboardingTop } from '@/components/ui/OnboardingFrame';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { enter, fade, space } from '@/theme';

// Darker toward the bottom so white type clears AA on any roof; one native gradient each (stacked slices banded).
const SCRIM = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.22) 33%, rgba(0,0,0,0.6) 67%, rgba(0,0,0,0.8) 100%)';
const TOP = 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0) 100%)';

const rise = enter;

/**
 * Step 1, the hook: a real licensed center in TX-04, in Apple's 3D flyover, turning slowly. One line,
 * one button. No numbers. The place is named by type and city only, never by name.
 */
export default function HookScreen() {
  const insets = useSafeAreaInsets();
  const record = useDaycareRecord(WELCOME_OPERATION_ID);
  const d = record.data?.daycare;
  // At large text, or on a short screen (iPhone SE), the lockup climbs to mid-screen, so the map is padded from
  // the bottom: the building, its pin and Apple's logo all sit in the clear top part, above the wordmark.
  const { height, fontScale } = useWindowDimensions();
  const lift = fontScale >= 1.35 ? 0.66 : height < 760 ? 0.55 : 0;
  // The caption names Apple's 3D view only once it has drawn; before that the Esri still carries its own credit.
  const [drawn, setDrawn] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View entering={fade(300)} style={StyleSheet.absoluteFill}>
        <FlyoverHero lat={d?.lat} lng={d?.lng} legalTop={insets.top + 56} bottomInset={lift ? Math.round(height * lift) : undefined} onReady={() => setDrawn(true)} />
      </Animated.View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.12)' }]} />
      <View
        pointerEvents="none"
        style={[styles.scrim, { backgroundImage: SCRIM }]}
      />
      <View
        pointerEvents="none"
        style={[styles.top, { height: insets.top + 96, backgroundImage: TOP }]}
      />

      <View style={{ paddingTop: insets.top + space.xs }}>
        <OnboardingTop step={1} onImage />
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Animated.View entering={rise(0)} accessible accessibilityLabel="Daycare Watch" style={styles.lockup}>
          <AppMark width={28} color="#FFFFFF" />
          <Text variant="headline" color="#FFFFFF">
            Daycare Watch
          </Text>
        </Animated.View>
        <Animated.View entering={rise(1)} style={{ gap: space.sm }}>
          <Text variant="display" color="#FFFFFF" accessibilityRole="header" style={styles.shadow}>
            Find the right daycare for your family.
          </Text>
          <Text variant="callout" color="rgba(255,255,255,0.9)" style={styles.shadow}>
            See what Texas inspectors found at any daycare, and get a heads-up when they post something new.
          </Text>
        </Animated.View>
        <Animated.View entering={rise(2)} style={{ gap: space.lg }}>
          <Text variant="footnote" color="rgba(255,255,255,0.78)" numberOfLines={2}>
            {d ? `A licensed center in ${tidyCase(d.city)}, TX${Platform.OS === 'ios' && drawn ? ' · 3D view, Apple Maps' : ''}` : ' '}
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
