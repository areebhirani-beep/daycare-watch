import { type ReactNode, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { minTap, space, spring, useColors } from '@/theme';

import { IconButton } from './Chrome';

/** Duolingo's top bar: a thick rounded track that springs forward from the previous step. */
export function ProgressBar({ step, of }: { step: number; of: number }) {
  const c = useColors();
  const p = useSharedValue((step - 1) / of);
  useEffect(() => {
    p.value = withSpring(step / of, { ...spring.pop, reduceMotion: ReduceMotion.System });
  }, [p, step, of]);
  const fill = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: c.sunken }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${of}`}
      accessibilityValue={{ min: 0, max: of, now: step }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: c.accent }, fill]}>
        <View style={[styles.shine, { backgroundColor: 'rgba(255,255,255,0.28)' }]} />
      </Animated.View>
    </View>
  );
}

type Props = {
  step: number;
  of?: number;
  /** The close button: skips onboarding. */
  onClose?: () => void;
  children: ReactNode;
  /** Pinned to the bottom edge: the one primary action and its quiet alternative. */
  actions: ReactNode;
  scroll?: boolean;
};

export function OnboardingFrame({ step, of = 3, onClose, children, actions, scroll = true }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + space.xs }]}>
      <View style={styles.bar}>
        {onClose ? <IconButton icon="close" label="Skip setup" onPress={onClose} size={36} tone="sunken" /> : null}
        <View style={{ flex: 1 }}>
          <ProgressBar step={step} of={of} />
        </View>
      </View>
      <Body
        {...(scroll
          ? { contentContainerStyle: styles.content, keyboardShouldPersistTaps: 'handled' as const, keyboardDismissMode: 'on-drag' as const }
          : { style: [styles.content, { flex: 1 }] })}
      >
        {children}
      </Body>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, space.lg), borderTopColor: c.hairline }]}>
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { minHeight: minTap, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { height: 14, borderRadius: 7, overflow: 'hidden' },
  fill: { height: 14, borderRadius: 7, minWidth: 14 },
  shine: { position: 'absolute', left: 8, right: 8, top: 3, height: 4, borderRadius: 2 },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xxxl, gap: space.xxl },
  actions: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
