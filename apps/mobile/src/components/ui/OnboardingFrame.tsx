import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { easeOut, haptic, minTap, motion, space, useColors, useIsDark } from '@/theme';

import { markOnboarded } from './onboarding';
import { Text } from './Text';

/** Steps in the flow: hook, how it works, find yours, alerts. The celebration isn't counted. */
export const ONBOARDING_STEPS = 4;

/** Duolingo's top bar: a thick rounded track that slides forward from the previous step. */
export function ProgressBar({ step, of = ONBOARDING_STEPS, onImage }: { step: number; of?: number; onImage?: boolean }) {
  const c = useColors();
  const p = useSharedValue((step - 1) / of);
  useEffect(() => {
    p.value = withTiming(step / of, { duration: motion.slow, easing: easeOut, reduceMotion: ReduceMotion.System });
  }, [p, step, of]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: onImage ? 'rgba(255,255,255,0.28)' : c.sunken }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${of}`}
      accessibilityValue={{ min: 0, max: of, now: step }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: onImage ? '#FFFFFF' : c.accent }, fill]}>
        <View style={[styles.shine, { backgroundColor: onImage ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.28)' }]} />
      </Animated.View>
    </View>
  );
}

/** Leaves onboarding from any step, straight to the map. Always visible. */
export function skipOnboarding() {
  haptic.select();
  markOnboarded();
  router.dismissAll();
  router.replace('/');
}

/** Progress bar + Skip, the top of every step. */
export function OnboardingTop({ step, onImage }: { step: number; onImage?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.bar}>
      <View style={{ flex: 1 }}>
        <ProgressBar step={step} onImage={onImage} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip setup" hitSlop={12} onPress={skipOnboarding} style={styles.skip}>
        <Text variant="subhead" color={onImage ? '#FFFFFF' : c.textSecondary} maxFontSizeMultiplier={1.4}>
          Skip
        </Text>
      </Pressable>
    </View>
  );
}

type Props = {
  step: number;
  children: ReactNode;
  /** Pinned to the bottom edge: the one primary action and its quiet alternative. */
  actions: ReactNode;
  scroll?: boolean;
};

export function OnboardingFrame({ step, children, actions, scroll = true }: Props) {
  const c = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + space.xs }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OnboardingTop step={step} />
      <Body
        {...(scroll
          ? { contentContainerStyle: styles.content, keyboardShouldPersistTaps: 'handled' as const, keyboardDismissMode: 'on-drag' as const }
          : { style: [styles.content, { flex: 1 }] })}
      >
        {children}
      </Body>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { minHeight: minTap, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.lg },
  skip: { minHeight: minTap, justifyContent: 'center' },
  track: { height: 14, borderRadius: 7, overflow: 'hidden' },
  fill: { height: 14, borderRadius: 7, minWidth: 14 },
  shine: { position: 'absolute', left: 8, right: 8, top: 3, height: 4, borderRadius: 2 },
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxl, gap: space.xl },
  actions: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm },
});
