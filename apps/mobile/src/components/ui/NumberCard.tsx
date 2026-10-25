import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { easeOut, motion, radius, space, useColors } from '@/theme';

import { Text } from './Text';

/**
 * Cal AI stat card: a small label, one huge tabular number, a quiet line of context.
 * It shows a count from the state's records. It never shows a score.
 */
export function NumberCard({
  label,
  value,
  sub,
  tint,
  ring,
  style,
}: {
  label: string;
  value: number | string;
  sub?: string;
  /** Colors the numeral, e.g. the High step of the record ramp. Defaults to text. */
  tint?: string;
  /** A share to draw as a ring beside the number, 0..1, e.g. findings verified fixed. */
  ring?: { value: number; label: string };
  style?: ViewStyle;
}) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${sub ? `. ${sub}` : ''}`}
      style={[styles.card, { backgroundColor: c.sunken }, fontScale > 1.5 && styles.wide, style]}
    >
      <Text variant="footnote" tone="secondary" numberOfLines={3}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text variant="numeral" color={tint} adjustsFontSizeToFit numberOfLines={1} style={{ flexShrink: 1 }}>
          {String(value)}
        </Text>
        {ring ? <Ring value={ring.value} size={44} stroke={6} /> : null}
      </View>
      {sub ? (
        <Text variant="footnote" tone="tertiary" numberOfLines={2} tabular>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress ring with round caps. Fills once on mount; Reduce Motion skips straight to the value. */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, value)), { duration: motion.slow, easing: easeOut, reduceMotion: ReduceMotion.System });
  }, [p, value]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${len} ${len}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/**
 * Open stat band: three counts side by side, no boxes, hairlines between them (Apple Fitness summary).
 * At accessibility sizes it stacks so no numeral is squeezed.
 */
export function StatBand({ items }: { items: { label: string; value: number | string; tint?: string }[] }) {
  const c = useColors();
  const { fontScale } = useWindowDimensions();
  const stack = fontScale > 1.5;
  return (
    <View style={[styles.band, stack && { flexDirection: 'column' }, { borderColor: c.hairline }]}>
      {items.map((it, i) => (
        <View
          key={it.label}
          accessible
          accessibilityLabel={`${it.label}: ${it.value}`}
          style={[
            styles.bandItem,
            i > 0 && (stack ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline } : { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }),
            i > 0 && !stack && { paddingLeft: space.lg },
          ]}
        >
          <Text variant="display" color={it.tint} tabular maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {String(it.value)}
          </Text>
          <Text variant="footnote" tone="secondary" numberOfLines={2}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** One wide card with a big ring and its share written out (Cal AI macro ring). */
export function RingCard({ value, of, title, sub }: { value: number; of: number; title: string; sub?: string }) {
  const c = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${title}: ${value} of ${of}${sub ? `. ${sub}` : ''}`}
      style={[styles.ringCard, { backgroundColor: c.sunken }]}
    >
      <Ring value={of > 0 ? value / of : 0} size={92} stroke={10}>
        <Text variant="title" tabular maxFontSizeMultiplier={1.2}>
          {`${value}/${of}`}
        </Text>
      </Ring>
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="headline">{title}</Text>
        {sub ? (
          <Text variant="footnote" tone="secondary" tabular>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Two-up grid for NumberCards (Cal AI card stack). */
export function NumberGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.stat, padding: space.lg, gap: space.xs, flexGrow: 1, flexBasis: '45%', minHeight: 132 },
  wide: { flexBasis: '100%', minHeight: 0 },
  band: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  bandItem: { flex: 1, paddingVertical: space.lg, gap: space.xxs },
  ringCard: { borderRadius: radius.stat, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.lg },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: 'auto' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
