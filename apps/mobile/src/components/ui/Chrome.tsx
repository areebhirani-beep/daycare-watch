import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, haptic, minTap, radius, sheet, space, type as typeScale, useColors } from '@/theme';

import { Glyph, type GlyphName } from './Glyph';
import { Text } from './Text';

const floatShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.14,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;

/**
 * Google Maps search pill. As a button (onPress) it opens search; with `input` props it is the field.
 * `trailing` holds one round control, e.g. the bell that opens Watching.
 */
export function SearchPill({
  placeholder = 'Search daycares, cities, ZIP',
  onPress,
  input,
  trailing,
  floating = true,
  style,
}: {
  placeholder?: string;
  onPress?: () => void;
  input?: TextInputProps;
  trailing?: ReactNode;
  floating?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const body = (
    <>
      <Glyph name="search" size={17} color={c.text} weight="bold" />
      {input ? (
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.input, { color: c.text }]}
          maxFontSizeMultiplier={1.6}
          {...input}
        />
      ) : (
        <Text variant="callout" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
          {placeholder}
        </Text>
      )}
      {trailing}
    </>
  );
  const shell = [
    styles.pill,
    { backgroundColor: floating ? c.surface : c.sunken },
    floating && floatShadow,
    style,
  ];
  if (onPress && !input) {
    return (
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        onPress={() => {
          haptic.select();
          onPress();
        }}
        style={({ pressed }) => [...shell, pressed && { opacity: 0.9 }]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={shell}>{body}</View>;
}

/** Round grey icon button used in sheet headers and section headers (uber-4, googlemaps-4). */
export function IconButton({
  icon,
  label,
  onPress,
  size = 36,
  tone = 'sunken',
}: {
  icon: GlyphName;
  label: string;
  onPress: () => void;
  size?: number;
  tone?: 'sunken' | 'surface' | 'ink';
}) {
  const c = useColors();
  const bg = tone === 'ink' ? c.ink : tone === 'surface' ? c.surface : c.sunken;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={(minTap - size) / 2 + 2}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        tone === 'surface' && floatShadow,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Glyph name={icon} size={size * 0.42} color={tone === 'ink' ? c.onInk : c.text} weight="bold" />
    </Pressable>
  );
}

/** Section header: bold title, optional count, and the round arrow that opens the full list (uber-4). */
export function SectionHeader({
  title,
  detail,
  onMore,
  inset = space.lg,
}: {
  title: string;
  detail?: string;
  onMore?: () => void;
  inset?: number;
}) {
  return (
    <View style={[styles.section, { paddingHorizontal: inset }]}>
      <View style={{ flex: 1 }}>
        <Text variant="title" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="secondary" tabular>
            {detail}
          </Text>
        ) : null}
      </View>
      {onMore ? <IconButton icon="chevronRight" label={`See all: ${title}`} onPress={onMore} /> : null}
    </View>
  );
}

/** The sheet grabber (Apple Maps): 36×5, centered, 6 from the top. Pass to gorhom as handleComponent. */
export function SheetHandle() {
  const c = useColors();
  return (
    <View style={styles.handleWrap} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.handle, { backgroundColor: c.border }]} />
    </View>
  );
}

/** Uber sticky bottom bar: hairline on top, surface fill, safe-area padding, one row of actions. */
export function StickyBar({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.sticky,
        { backgroundColor: c.surface, borderTopColor: c.hairline, paddingBottom: Math.max(insets.bottom, space.lg) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Square grey side button that sits beside the main CTA (uber-3). */
export function SquareButton({ icon, label, onPress }: { icon: GlyphName; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [styles.square, { backgroundColor: c.sunken }, pressed && { opacity: 0.7 }]}
    >
      <Glyph name={icon} size={20} color={c.text} weight="bold" />
    </Pressable>
  );
}

/** Google Maps action pill (Call · Directions · Official record · Share). */
export function ActionPill({ icon, label, onPress, primary }: { icon: GlyphName; label: string; onPress: () => void; primary?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: primary ? c.signal : c.sunken },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Glyph name={icon} size={15} color={primary ? c.onSignal : c.text} weight="bold" />
      <Text variant="subhead" color={primary ? c.onSignal : c.text} numberOfLines={1} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </Pressable>
  );
}

export const SHEET_GRABBER = sheet.grabber;

/**
 * Uber-style action tile: icon over a short label, equal widths, so a row of three always fits
 * (no pill clipped mid-word at the screen edge).
 */
export function ActionTile({ icon, label, onPress }: { icon: GlyphName; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [styles.tile, elevation.card, { backgroundColor: c.surface, transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }]}
    >
      <Glyph name={icon} size={20} color={c.text} weight="semibold" />
      <Text variant="subhead" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 64, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: space.xs },
  pill: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingLeft: space.lg + 2,
    paddingRight: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  input: { flex: 1, ...typeScale.callout, paddingVertical: space.md },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: minTap },
  handleWrap: { paddingTop: sheet.grabber.top, paddingBottom: space.sm, alignItems: 'center' },
  handle: { width: sheet.grabber.width, height: sheet.grabber.height, borderRadius: 3 },
  sticky: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm + 2,
    paddingTop: space.md,
    paddingHorizontal: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  square: { width: 60, height: 56, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  action: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
