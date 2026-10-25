import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { easeOut, haptic, elevation, motion, space, useColors } from '@/theme';

import { Text } from './Text';

const DROP = 32;

const icon = require('../../../assets/images/icon.png') as number;

/**
 * An iOS notification banner showing our real push copy. It slides in from above (250 ms, no bounce) with a
 * light haptic. `tag` sits where iOS shows "now" ("Example", "Replay").
 */
export function AlertBanner({
  title,
  body,
  tag = 'now',
  drop = true,
  delay = 0,
  maxScale,
  style,
}: {
  title: string;
  body: string;
  tag?: string;
  /** Animate in from above (with a haptic). False renders it at rest. */
  drop?: boolean;
  delay?: number;
  /** Caps Dynamic Type when the banner is an illustration inside a mock screen. */
  maxScale?: number;
  style?: ViewStyle;
}) {
  const c = useColors();
  const y = useSharedValue(drop ? -DROP : 0);
  useEffect(() => {
    if (!drop) return;
    // A push arriving: slides down from where iOS banners come from, eases out, no bounce.
    y.value = withDelay(delay, withTiming(0, { duration: motion.slow, easing: easeOut, reduceMotion: ReduceMotion.System }));
    const id = setTimeout(haptic.press, delay + 200);
    return () => clearTimeout(id);
  }, [drop, delay, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: 1 + y.value / DROP }));
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${tag === 'now' ? 'Alert' : `${tag} alert`}. ${title}. ${body}`}
      style={[styles.banner, elevation.float, { backgroundColor: c.surface }, s, style]}
    >
      <Image source={icon} style={styles.icon} accessibilityLabel="" />
      <View style={{ flex: 1, gap: 1 }}>
        <View style={styles.top}>
          <Text variant="subhead" numberOfLines={1} style={{ flex: 1 }} maxFontSizeMultiplier={maxScale}>
            {title}
          </Text>
          <Text variant="footnote" tone="tertiary" maxFontSizeMultiplier={maxScale}>
            {tag}
          </Text>
        </View>
        <Text variant="callout" tone="secondary" numberOfLines={3} maxFontSizeMultiplier={maxScale}>
          {body}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 24, padding: space.md, flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: { width: 38, height: 38, borderRadius: 9 },
});
