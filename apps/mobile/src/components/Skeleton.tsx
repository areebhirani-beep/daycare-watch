import { useEffect } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, space, useColors } from '@/theme';

export function SkeletonBlock({ width = '100%', height = 14 }: { width?: DimensionValue; height?: number }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduced) opacity.value = withRepeat(withTiming(0.55, { duration: 900 }), -1, true);
  }, [opacity, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, backgroundColor: c.skeleton, borderRadius: radius.sm }, anim]}
    />
  );
}

/** Shaped like the record page: title, facts, then three findings. */
export function RecordSkeleton() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading the state record" accessible>
      <SkeletonBlock width="70%" height={30} />
      <SkeletonBlock width="50%" height={16} />
      <View style={{ height: space.lg }} />
      <SkeletonBlock height={48} />
      <View style={{ height: space.xl }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.finding}>
          <SkeletonBlock width="35%" height={12} />
          <SkeletonBlock width="90%" height={16} />
          <SkeletonBlock width="60%" height={16} />
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading" accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.finding}>
          <SkeletonBlock width="65%" height={17} />
          <SkeletonBlock width="40%" height={13} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.xl, gap: space.sm },
  finding: { gap: space.sm, paddingVertical: space.md },
});
