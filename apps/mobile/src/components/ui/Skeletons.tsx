import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, space, useColors } from '@/theme';

/** A grey block with a slow breathe while data loads. Stops under Reduce Motion. */
export function Block({ style }: { style?: ViewStyle }) {
  const c = useColors();
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.55, { duration: 900, reduceMotion: ReduceMotion.System }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: c.skeleton, borderRadius: 6 }, style, a]} />;
}

/** Shaped like DaycareCard. */
export function CardSkeleton({ width = 280, heroRatio = 2 }: { width?: number | `${number}%`; heroRatio?: number }) {
  return (
    <View style={{ width }} accessibilityLabel="Loading" accessible>
      <Block style={{ aspectRatio: heroRatio, borderRadius: radius.thumb }} />
      <Block style={{ marginTop: space.sm + 2, height: 18, width: '70%' }} />
      <Block style={{ marginTop: 6, height: 13, width: '50%' }} />
      <Block style={{ marginTop: space.sm, height: 16, width: '90%' }} />
    </View>
  );
}

/** Shaped like PlaceRow. */
export function RowSkeleton() {
  return (
    <View style={styles.row} accessibilityLabel="Loading" accessible>
      <Block style={{ width: 64, height: 64, borderRadius: radius.thumb }} />
      <View style={{ flex: 1, gap: 6 }}>
        <Block style={{ height: 17, width: '65%' }} />
        <Block style={{ height: 13, width: '45%' }} />
        <Block style={{ height: 14, width: '80%' }} />
      </View>
    </View>
  );
}

/** Shaped like a NumberCard. */
export function NumberSkeleton() {
  const c = useColors();
  return (
    <View style={[styles.number, { backgroundColor: c.sunken }]}>
      <Block style={{ height: 13, width: '60%' }} />
      <Block style={{ height: 48, width: 56, marginTop: 'auto', borderRadius: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, alignItems: 'center' },
  number: { flexGrow: 1, flexBasis: '45%', minHeight: 132, borderRadius: radius.stat, padding: space.lg },
  stripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, paddingHorizontal: space.lg },
  band: { flexDirection: 'row', gap: space.lg, paddingVertical: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
});

/** Shaped like PlacePage: map hero, name, chips, record strip, stat band. */
export function PlaceSkeleton({ heroHeight = 300 }: { heroHeight?: number }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }} accessibilityLabel="Loading the state record" accessible>
      <Block style={{ height: heroHeight, borderRadius: 0 }} />
      <View style={{ padding: space.lg, gap: space.md }}>
        <Block style={{ height: 34, width: '80%' }} />
        <Block style={{ height: 15, width: '55%' }} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Block style={{ height: 34, width: 110, borderRadius: radius.pill }} />
          <Block style={{ height: 34, width: 120, borderRadius: radius.pill }} />
        </View>
        <Block style={{ height: 22, width: '45%', marginTop: space.xl }} />
        <View style={styles.stripRow}>
          {[2, 0, 4, 1, 3].map((n, i) => (
            <Block key={i} style={{ width: 20, height: n === 0 ? 6 : n * 22, borderRadius: 6 }} />
          ))}
        </View>
        <View style={[styles.band, { borderColor: c.hairline }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, gap: space.sm }}>
              <Block style={{ height: 34, width: 40, borderRadius: 8 }} />
              <Block style={{ height: 13, width: '70%' }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
