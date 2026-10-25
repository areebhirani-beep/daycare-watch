import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { minTap, space, useColors } from '@/theme';

import { StepMarks } from './StepMarks';

type Props = {
  step: number;
  of?: number;
  onSkip?: () => void;
  skipLabel?: string;
  children: ReactNode;
  /** Pinned to the bottom edge: the one primary action and its quiet alternative. */
  actions: ReactNode;
};

export function OnboardingFrame({ step, of = 3, onSkip, skipLabel = 'Skip', children, actions }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.bar}>
        <StepMarks step={step} of={of} />
        {onSkip ? (
          <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={12} style={styles.skip}>
            <T variant="callout" tone="secondary">
              {skipLabel}
            </T>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
      <View
        style={[
          styles.actions,
          { paddingBottom: Math.max(insets.bottom, space.lg), borderTopColor: c.hairline, backgroundColor: c.bg },
        ]}
      >
        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    minHeight: minTap,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: { minHeight: minTap, justifyContent: 'center' },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xl },
  actions: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
});
