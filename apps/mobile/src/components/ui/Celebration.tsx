import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic, spring, useColors } from '@/theme';

import { Glyph } from './Glyph';

// Twelve marks shaped like the record strip's, thrown out from the badge and left resting there.
const MARKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
  const d = 92 + (i % 3) * 18;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: (i * 47) % 90 - 45, solid: i % 3 !== 0, delay: (i % 4) * 25 };
});

function Mark({ x, y, r, solid, delay, color }: (typeof MARKS)[number] & { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(120 + delay, withSpring(1, { ...spring.pop, reduceMotion: ReduceMotion.System }));
  }, [t, delay]);
  const s = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.5),
    transform: [{ translateX: x * t.value }, { translateY: y * t.value }, { rotate: `${r * t.value}deg` }, { scale: 0.4 + t.value * 0.6 }],
  }));
  return (
    <Animated.View
      style={[styles.mark, solid ? { backgroundColor: color } : { borderWidth: 2.5, borderColor: color }, s]}
    />
  );
}

/** The moment watching starts: a badge pops, marks burst around it, a success haptic lands. */
export function Celebration({ size = 120 }: { size?: number }) {
  const c = useColors();
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1, { ...spring.pop, reduceMotion: ReduceMotion.System });
    const id = setTimeout(haptic.success, 140);
    return () => clearTimeout(id);
  }, [pop]);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: 1 - pop.value * 0.6,
    transform: [{ scale: 0.8 + pop.value * 0.5 }],
  }));
  return (
    <View style={{ width: size * 2.6, height: size * 2.6, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden>
      <Animated.View style={[{ position: 'absolute', width: size * 1.5, height: size * 1.5, borderRadius: size, backgroundColor: c.accentSoft }, ring]} />
      {MARKS.map((m, i) => (
        <Mark key={i} {...m} color={i % 3 === 0 ? c.ink : c.signal} />
      ))}
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c.signal,
            alignItems: 'center',
            justifyContent: 'center',
            // The same solid bottom edge as the 3D buttons, not a soft shadow.
            borderBottomWidth: 6,
            borderBottomColor: c.signalEdge,
          },
          badge,
        ]}
      >
        <Glyph name="bellFill" size={size * 0.42} color={c.onSignal} weight="bold" />
      </Animated.View>
    </View>
  );
}

/** A one-shot fade+rise for content that follows the burst. */
export function useRise(delay = 0) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 360, reduceMotion: ReduceMotion.System }));
  }, [t, delay]);
  return useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 12 }] }));
}

const styles = StyleSheet.create({
  mark: { position: 'absolute', width: 14, height: 18, borderRadius: 5 },
});
