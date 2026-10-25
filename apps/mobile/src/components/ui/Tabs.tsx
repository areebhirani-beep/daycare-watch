import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { haptic, minTap, space, spring, useColors } from '@/theme';

import { Text } from './Text';

/** Google Maps place-sheet tabs. The underline springs to the selected tab. */
export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const c = useColors();
  const [boxes, setBoxes] = useState<Record<string, { x: number; w: number }>>({});
  const box = boxes[value];
  const bar = useAnimatedStyle(() =>
    box
      ? { opacity: 1, transform: [{ translateX: withSpring(box.x, spring.sheet) }], width: withSpring(box.w, spring.sheet) }
      : { opacity: 0 },
  );
  return (
    <View accessibilityRole="tablist" style={[styles.row, { borderBottomColor: c.hairline }]}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            // react-native-web drops accessibilityState; aria-selected carries it to the web build.
            aria-selected={on}
            onLayout={(e: LayoutChangeEvent) => {
              const { x, width } = e.nativeEvent.layout;
              setBoxes((b) => (b[t.key]?.x === x && b[t.key]?.w === width ? b : { ...b, [t.key]: { x, w: width } }));
            }}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(t.key);
            }}
            style={styles.tab}
          >
            <Text variant="subhead" tone={on ? 'primary' : 'tertiary'} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.bar, { backgroundColor: c.ink }, bar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.sm },
  tab: { minHeight: minTap + 4, paddingHorizontal: space.md, justifyContent: 'center', flexGrow: 1, alignItems: 'center' },
  bar: { position: 'absolute', left: 0, bottom: -StyleSheet.hairlineWidth, height: 3, borderRadius: 1.5 },
});
