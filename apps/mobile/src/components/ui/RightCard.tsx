import { Pressable, StyleSheet, View } from 'react-native';

import { haptic, radius, space, useColors } from '@/theme';

import { Glyph, type GlyphName } from './Glyph';
import { Text } from './Text';

/** A right the parent can use in one tap. Pressing it opens the ready-to-send request. */
export function RightCard({ icon, title, detail, onPress }: { icon: GlyphName; title: string; detail: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityHint="Opens a ready-to-send request citing the law"
      onPress={() => {
        haptic.press();
        onPress();
      }}
      style={({ pressed }) => [styles.right, { backgroundColor: c.sunken, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <View style={[styles.rightIcon, { backgroundColor: c.surface }]}>
        <Glyph name={icon} size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        <Text variant="footnote" tone="secondary">
          {detail}
        </Text>
      </View>
      <Glyph name="share" size={16} color={c.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  right: { borderRadius: radius.card, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 76 },
  rightIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
