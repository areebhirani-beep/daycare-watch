import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { easeOut, haptic, motion, useColors } from '@/theme';

import { Glyph } from './Glyph';

/**
 * Watching confirmed: the yellow badge fades in, then the check draws
 * once, left to right (350 ms), with a success haptic. No confetti, no burst, no pulse.
 */
export function Celebration({ size = 120 }: { size?: number }) {
  const c = useColors();
  const badge = useSharedValue(0);
  const draw = useSharedValue(0);
  useEffect(() => {
    badge.value = withTiming(1, { duration: motion.base, easing: easeOut, reduceMotion: ReduceMotion.System });
    draw.value = withDelay(motion.base, withTiming(1, { duration: 350, easing: easeOut, reduceMotion: ReduceMotion.System }));
    const id = setTimeout(haptic.success, motion.base + 300);
    return () => clearTimeout(id);
  }, [badge, draw]);
  const glyph = size * 0.46;
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badge.value }));
  // A wipe that uncovers the check from its short stroke to its long one reads as the mark being drawn.
  const wipe = useAnimatedStyle(() => ({ width: glyph * draw.value }));
  return (
    <View style={[styles.center, { width: size * 1.8, height: size * 1.8 }]} accessibilityElementsHidden>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={{ width: size * 1.6, height: size * 1.6, borderRadius: size, backgroundColor: c.accentSoft }} />
      </View>
      <Animated.View
        style={[
          styles.center,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c.signal,
            // The same solid bottom edge as the 3D buttons, not a soft shadow.
            borderBottomWidth: 6,
            borderBottomColor: c.signalEdge,
          },
          badgeStyle,
        ]}
      >
        <View style={{ width: glyph, height: glyph, alignItems: 'flex-start' }}>
          <Animated.View style={[{ height: glyph, overflow: 'hidden' }, wipe]}>
            <View style={{ width: glyph, height: glyph }}>
              <Glyph name="check" size={glyph} color={c.onSignal} weight="heavy" />
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

/** A one-shot fade + 8 pt rise for content that follows the check. */
export function useRise(delay = 0) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: motion.base, easing: easeOut, reduceMotion: ReduceMotion.System }));
  }, [t, delay]);
  return useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * motion.rise }] }));
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
