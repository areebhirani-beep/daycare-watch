import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { haptic, radius, space, useColors } from '@/theme';

import { Glyph, type GlyphName } from './Glyph';
import { Text } from './Text';

/** Google Maps filter chip. Selected = ink fill, the strongest state the app has short of the accent. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  floating,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: GlyphName;
  /** Over the map: white with a shadow instead of a grey fill. */
  floating?: boolean;
}) {
  const c = useColors();
  const bg = selected ? c.ink : floating ? c.surface : c.sunken;
  const fg = selected ? c.onInk : c.text;
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: Boolean(selected) }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        floating && !selected && chipShadow,
      ]}
    >
      {icon ? <Glyph name={icon} size={13} color={fg} weight="bold" /> : null}
      {selected && !icon ? <Glyph name="check" size={12} color={fg} weight="heavy" /> : null}
      <Text variant="subhead" color={fg} numberOfLines={1} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A horizontally scrolling chip row that bleeds to the screen edges. */
export function ChipRow({ children, inset = space.lg, style }: { children: React.ReactNode; inset?: number; style?: ViewStyle }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[{ paddingHorizontal: inset, gap: space.sm }, style]}
      style={{ flexGrow: 0 }}
    >
      {children}
    </ScrollView>
  );
}

/** Place-page fact chip: icon + short label on the sunken grey. Static, not a control. */
export function InfoChip({ icon, label, accessibilityLabel }: { icon: GlyphName; label: string; accessibilityLabel?: string }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.info, { backgroundColor: c.surface }]}
    >
      <Glyph name={icon} size={14} color={c.textSecondary} />
      <Text variant="subhead" numberOfLines={1} maxFontSizeMultiplier={1.6} tabular>
        {label}
      </Text>
    </View>
  );
}

/** First-view facts cap (DESIGN.md §9). Anything past three belongs behind "More details". */
export const MAX_FACTS = 3;

/** The place page's fact row. At most three facts, wrapping to a second line rather than clipping at the edge. */
export function FactChips({ facts }: { facts: { icon: GlyphName; label: string; a11y?: string }[] }) {
  return (
    <View style={styles.facts}>
      {facts.slice(0, MAX_FACTS).map((f) => (
        <InfoChip key={f.label} icon={f.icon} label={f.label} accessibilityLabel={f.a11y} />
      ))}
    </View>
  );
}

const chipShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  info: {
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
