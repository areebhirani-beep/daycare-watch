import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { haptic, minTap, space, spring, useColors } from '@/theme';

import { Glyph } from './Glyph';
import { Text } from './Text';

/**
 * Progressive disclosure (DESIGN.md §9): first view shows the headline, three facts, the strip and one
 * action. Everything else waits behind one of these rows.
 */
export function Disclosure({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withSpring(open ? '90deg' : '0deg', spring.press) }] }));
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic.select();
          setOpen((o) => !o);
        }}
        style={({ pressed }) => [styles.row, { borderColor: c.hairline }, pressed && { opacity: 0.6 }]}
      >
        <View style={{ flex: 1 }}>
          <Text variant="subhead">{title}</Text>
          {detail && !open ? (
            <Text variant="callout" tone="secondary" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Animated.View style={chevron}>
          <Glyph name="chevronRight" size={15} color={c.textSecondary} weight="bold" />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={styles.body}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTap + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.md,
  },
  body: { paddingTop: space.xl, gap: space.xxl },
});
