import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { buttonEdge, haptic, minTap, radius, space, spring, useColors, motion } from '@/theme';

import { Glyph, type GlyphName } from './Glyph';
import { Text } from './Text';

type Kind = 'primary' | 'ink' | 'secondary' | 'plain' | 'onImage';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  kind?: Kind;
  icon?: GlyphName;
  /** Smaller 44-pt button for rows and sheets. */
  size?: 'lg' | 'md';
  style?: ViewStyle;
  trailing?: ReactNode;
};

/**
 * Duolingo's 3D button: a face sitting on a darker edge. Pressing drops the face onto the edge
 * with a spring and a light haptic, so every primary action feels physical.
 */
export function Button({ label, kind = 'primary', icon, size = 'lg', style, onPress, disabled, trailing, ...rest }: Props) {
  const c = useColors();
  const down = useSharedValue(0);
  const edge = kind === 'plain' ? 0 : size === 'lg' ? buttonEdge : 3;
  const h = size === 'lg' ? 56 : minTap;

  const palette = {
    primary: { face: c.signal, edge: c.signalEdge, fg: c.onSignal, border: undefined },
    ink: { face: c.ink, edge: c.inkEdge, fg: c.onInk, border: undefined },
    secondary: { face: c.surface, edge: c.secondaryEdge, fg: c.text, border: c.border },
    plain: { face: 'transparent', edge: 'transparent', fg: c.accent, border: undefined },
    // White in both modes: sits on photos and the 3D flyover.
    onImage: { face: '#FFFFFF', edge: '#BDBDC4', fg: '#0B0B0C', border: undefined },
  }[kind];
  const face = disabled && kind !== 'plain' ? c.sunken : palette.face;
  const edgeColor = disabled && kind !== 'plain' ? c.hairline : palette.edge;
  const fg = disabled ? c.textTertiary : palette.fg;

  // Press feedback (motion rules): 0.98 scale + 0.9 opacity, settles without bounce.
  const faceStyle = useAnimatedStyle(() => ({
    opacity: 1 - down.value * (1 - motion.pressOpacity),
    transform: [{ scale: 1 - down.value * (1 - motion.pressScale) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPressIn={() => {
        down.value = withSpring(1, spring.press);
      }}
      onPressOut={() => {
        down.value = withSpring(0, spring.press);
      }}
      onPress={(e) => {
        haptic.press();
        onPress?.(e);
      }}
      style={[{ minHeight: h + edge }, style]}
      {...rest}
    >
      <View style={[styles.edge, { top: edge, height: h, backgroundColor: edgeColor }]} />
      <Animated.View
        style={[
          styles.face,
          { minHeight: h, backgroundColor: face },
          palette.border && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: palette.border },
          faceStyle,
        ]}
      >
        {icon ? <Glyph name={icon} color={fg} size={size === 'lg' ? 18 : 15} weight="bold" /> : null}
        <Text
          variant="headline"
          color={fg}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={1.5}
          align="center"
          style={{ flexShrink: 1 }}
        >
          {label}
        </Text>
        {trailing}
      </Animated.View>
    </Pressable>
  );
}

/** Round icon button that floats over the map (locate, close, back). */
export function FloatButton({
  icon,
  label,
  onPress,
  tone = 'surface',
  style,
}: {
  icon: GlyphName;
  label: string;
  onPress: () => void;
  tone?: 'surface' | 'accent';
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.float,
        { backgroundColor: tone === 'accent' ? c.signal : c.surface, transform: [{ scale: pressed ? motion.pressScale : 1 }], opacity: pressed ? motion.pressOpacity : 1 },
        floatShadow,
        style,
      ]}
    >
      <Glyph name={icon} size={18} color={tone === 'accent' ? c.onSignal : c.accent} weight="bold" />
    </Pressable>
  );
}

const floatShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.16,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 6,
} as const;

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0, borderRadius: radius.button },
  face: {
    borderRadius: radius.button,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  float: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
