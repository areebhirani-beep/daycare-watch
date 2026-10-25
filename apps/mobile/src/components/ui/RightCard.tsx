import { Pressable, StyleSheet, View } from 'react-native';

import { haptic, space, useColors } from '@/theme';

import { Glyph, type GlyphName } from './Glyph';
import { Text } from './Text';

/** A right the parent can use in one tap: a list row, not a card, so a page of rights reads as one list. */
export function RightCard({
  icon,
  title,
  detail,
  onPress,
  hint = 'Opens a ready-to-send request citing the law',
  trailing = 'share',
}: {
  icon: GlyphName;
  title: string;
  detail: string;
  onPress: () => void;
  hint?: string;
  /** `share` for a request it composes, `chevronRight` for a screen, `external` for a page outside the app. */
  trailing?: GlyphName;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityHint={hint}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      style={({ pressed }) => [styles.right, { borderBottomColor: c.hairline }, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.rightIcon, { backgroundColor: c.sunken }]}>
        <Glyph name={icon} size={18} color={c.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        <Text variant="footnote" tone="secondary">
          {detail}
        </Text>
      </View>
      <Glyph name={trailing} size={16} color={c.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  right: { paddingVertical: space.lg, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 76, borderBottomWidth: StyleSheet.hairlineWidth },
  rightIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
