import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { type Colors, haptic, enter, useColors } from '@/theme';

import { Glyph } from './Glyph';
import { dayValue, stripSentence, type StripVisit } from './strip';
import { Text as T } from './Text';

/**
 * The visit rail: every state visit in a window, one circle on a time line, placed where it happened.
 * The number inside is how many findings the state posted from that visit, and the circle grows with it.
 * Solid: every finding was corrected at the inspection or verified fixed. Outlined: some fixes are not yet
 * verified by the state. A ring with a check: a visit with no findings posted. A notch: at least one finding
 * was on a rule the state rates High risk.
 * It shows counts and dates only. It is never a grade.
 */

export { dayValue, stripFromRecord, stripFromRow, stripSentence } from './strip';
export type { Rank, RowVisit, StripMark, StripVisit } from './strip';

/** min/max: circle sizes for 1 and 10+ findings. zero: the no-findings ring. num: smallest legible numeral. */
type Geometry = { min: number; max: number; zero: number; num: number; gap: number };

const FULL: Geometry = { min: 24, max: 38, zero: 18, num: 11, gap: 4 };
const HERO: Geometry = { min: 30, max: 52, zero: 22, num: 13, gap: 5 };
const COMPACT: Geometry = { min: 18, max: 25, zero: 12, num: 9, gap: 3 };
// Axis labels sit under fixed-size circles, so they grow with Dynamic Type only this far.
const AXIS_MAX_SCALE = 1.35;

function diameter(v: StripVisit, g: Geometry): number {
  const n = v.marks.length;
  if (n === 0) return g.zero;
  return g.min + (g.max - g.min) * Math.sqrt((Math.min(n, 10) - 1) / 9);
}

type Placed = StripVisit & { t: number; d: number; cx: number };

function place(visits: StripVisit[], width: number, start: number, end: number, g: Geometry): Placed[] {
  const dated = visits
    .map((v) => ({ ...v, t: dayValue(v.date) ?? Number.NaN, d: diameter(v, g), cx: 0 }))
    .filter((v) => v.t >= start && v.t <= end)
    .sort((a, b) => a.t - b.t);
  if (width <= 0 || dated.length === 0) return dated;
  // A busy record shrinks every circle together so they still sit side by side.
  const total = dated.reduce((s, v) => s + v.d, 0) + g.gap * (dated.length - 1);
  const k = total > width ? width / total : 1;
  for (const v of dated) v.d *= k;
  for (const v of dated) v.cx = v.d / 2 + ((v.t - start) / (end - start)) * (width - v.d);
  for (let i = 1; i < dated.length; i++) {
    const a = dated[i - 1]!;
    const b = dated[i]!;
    b.cx = Math.max(b.cx, a.cx + a.d / 2 + g.gap * k + b.d / 2);
  }
  for (let i = dated.length - 1; i >= 0; i--) {
    const v = dated[i]!;
    const next = dated[i + 1];
    const limit = next ? next.cx - next.d / 2 - g.gap * k - v.d / 2 : width - v.d / 2;
    v.cx = Math.max(v.d / 2, Math.min(v.cx, limit));
  }
  return dated;
}

function Visit({ v, g, c, selected }: { v: Placed; g: Geometry; c: Colors; selected: boolean }) {
  const n = v.marks.length;
  const d = v.d;
  const open = v.marks.some((m) => m.open);
  const high = v.marks.some((m) => m.rank === 5);
  const notch = Math.max(8, Math.round(d * 0.36));
  return (
    <View style={{ width: d, height: d }}>
      {selected ? (
        <View style={[styles.halo, { width: d + 10, height: d + 10, borderRadius: (d + 10) / 2, borderColor: c.accent }]} />
      ) : null}
      {n === 0 ? (
        <View
          style={[
            styles.circle,
            { width: d, height: d, borderRadius: d / 2, backgroundColor: c.surface, borderWidth: 1.5 },
            v.pending ? { borderColor: c.textTertiary, borderStyle: 'dashed' } : { borderColor: c.textTertiary },
          ]}
        >
          {v.pending ? null : <Glyph name="check" size={Math.max(6, d * 0.5)} color={c.textSecondary} weight="bold" />}
        </View>
      ) : (
        <View
          style={[
            styles.circle,
            { width: d, height: d, borderRadius: d / 2 },
            open ? { backgroundColor: c.surface, borderWidth: Math.max(2, d * 0.08), borderColor: c.text } : { backgroundColor: c.text },
          ]}
        >
          <RNText
            allowFontScaling={false}
            style={[
              styles.num,
              { fontSize: Math.max(g.num, d * 0.46), lineHeight: Math.max(g.num, d * 0.46) * 1.1, color: open ? c.text : c.surface },
            ]}
          >
            {n > 99 ? '99+' : String(n)}
          </RNText>
        </View>
      )}
      {high ? (
        <View
          style={[
            styles.notch,
            { width: notch, height: notch, borderRadius: notch / 2, backgroundColor: c.risk.High, borderColor: c.surface },
          ]}
        />
      ) : null}
    </View>
  );
}

type Props = {
  visits: StripVisit[];
  /** full: alert and findings, with a time axis. hero: the place page and onboarding. compact: cards and list rows. */
  variant?: 'full' | 'hero' | 'compact';
  months?: number;
  now?: Date;
  onPressVisit?: (id: StripVisit['id']) => void;
  selectedId?: StripVisit['id'] | null;
  showKey?: boolean;
  /** compact only: a quiet '24 months ago' / 'Today' line under the rail, for the callout and Watching. */
  labels?: boolean;
};

export function RecordStrip({
  visits,
  variant = 'full',
  months = 24,
  now,
  onPressVisit,
  selectedId,
  showKey = true,
  labels = false,
}: Props) {
  const c = useColors();
  const g = variant === 'hero' ? HERO : variant === 'full' ? FULL : COMPACT;
  const isFull = variant !== 'compact';
  const [width, setWidth] = useState(0);
  const end = useMemo(() => {
    const d = now ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }, [now]);
  const startDate = useMemo(() => {
    const d = new Date(end);
    return new Date(d.getFullYear(), d.getMonth() - months, d.getDate());
  }, [end, months]);
  const start = startDate.getTime();

  const placed = useMemo(() => place(visits, width, start, end, g), [visits, width, start, end, g]);
  // Room for the biggest circle this record could draw plus the selection halo, so the rail never jumps.
  const plotH = Math.max(g.max * 0.8, ...placed.map((v) => v.d)) + (isFull ? 12 : 4);
  const mid = plotH / 2;
  const sentence = stripSentence(placed, months);
  const hasOpen = placed.some((v) => v.marks.some((m) => m.open));
  const hasHigh = placed.some((v) => v.marks.some((m) => m.rank === 5));

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  // January ticks, skipped when they would crowd the edge labels.
  const years: { x: number; label: string }[] = [];
  if (isFull && width > 0) {
    for (let y = startDate.getFullYear() + 1; y <= new Date(end).getFullYear(); y++) {
      const x = ((new Date(y, 0, 1).getTime() - start) / (end - start)) * width;
      if (x > 56 && x < width - 56) years.push({ x, label: String(y) });
    }
  }
  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={sentence}>
      <View onLayout={onLayout} style={{ height: plotH }}>
        <View style={[styles.line, { top: mid - 1, backgroundColor: c.border }]} />
        {years.map((y) => (
          <View key={y.label} style={[styles.tick, { left: y.x, top: mid - 5, backgroundColor: c.border }]} />
        ))}
        {width > 0 &&
          placed.map((v, i) => {
            const selected = selectedId != null && selectedId === v.id;
            const body = (
              <Animated.View
                entering={enter(i)}
              >
                <Visit v={v} g={g} c={c} selected={selected} />
              </Animated.View>
            );
            const pos = { left: v.cx - v.d / 2, top: mid - v.d / 2 };
            if (!onPressVisit || !isFull)
              return (
                <View key={String(v.id)} pointerEvents="none" style={[styles.at, pos]}>
                  {body}
                </View>
              );
            return (
              <Pressable
                key={String(v.id)}
                accessible={false}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                onPress={() => {
                  haptic.select();
                  onPressVisit(v.id);
                }}
                style={({ pressed }) => [styles.at, pos, pressed && { opacity: 0.6 }]}
              >
                {body}
              </Pressable>
            );
          })}
      </View>

      {isFull ? (
        <View style={styles.axis}>
          <T variant="caption" tone="tertiary" maxFontSizeMultiplier={AXIS_MAX_SCALE} tabular>
            {startLabel}
          </T>
          {years.map((y) => (
            <View key={y.label} style={[styles.yearLabel, { left: y.x }]}>
              <T variant="caption" tone="tertiary" maxFontSizeMultiplier={AXIS_MAX_SCALE} tabular>
                {y.label}
              </T>
            </View>
          ))}
          <T variant="caption" tone="tertiary" maxFontSizeMultiplier={AXIS_MAX_SCALE}>
            Today
          </T>
        </View>
      ) : null}

      {!isFull && labels ? (
        <View style={[styles.axis, { marginTop: 4 }]}>
          <T variant="caption" tone="tertiary" maxFontSizeMultiplier={AXIS_MAX_SCALE}>{`${months} months ago`}</T>
          <T variant="caption" tone="tertiary" maxFontSizeMultiplier={AXIS_MAX_SCALE}>
            Today
          </T>
        </View>
      ) : null}

      {isFull && showKey && (hasOpen || hasHigh) ? <StripKey open={hasOpen} high={hasHigh} /> : null}
    </View>
  );
}

/** One line, and only the items this record actually draws. The number in a circle explains itself. */
export function StripKey({ open = true, high = true }: { open?: boolean; high?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.key} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {open ? (
        <View style={styles.keyItem}>
          <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: c.text }} />
          <T variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
            Fixes not yet verified
          </T>
        </View>
      ) : null}
      {high ? (
        <View style={styles.keyItem}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.risk.High }} />
          <T variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
            High-risk rule cited
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1 },
  tick: { position: 'absolute', width: 2, height: 10, borderRadius: 1, marginLeft: -1 },
  at: { position: 'absolute' },
  circle: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', left: -5, top: -5, borderWidth: 2.5 },
  num: { fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5, textAlign: 'center' },
  notch: { position: 'absolute', top: -2, right: -2, borderWidth: 2 },
  axis: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between', minHeight: 16 },
  yearLabel: { position: 'absolute', top: 0, alignItems: 'center', transform: [{ translateX: -30 }], width: 60 },
  key: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 6 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '100%' },
});

/** Loading state in the rail's own shape: the line and a few quiet circles, no shimmer. */
export function StripSkeleton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const c = useColors();
  const g = variant === 'full' ? FULL : COMPACT;
  const h = g.max * 0.8 + (variant === 'full' ? 12 : 4);
  const dots = [
    [0.08, g.min],
    [0.34, g.zero],
    [0.58, g.min + 6],
    [0.9, g.min],
  ] as const;
  return (
    <View accessibilityLabel="Loading the state record">
      <View style={{ height: h }}>
        <View style={[styles.line, { top: h / 2 - 1, backgroundColor: c.skeleton }]} />
        {dots.map(([x, d], i) => (
          <View
            key={i}
            style={[styles.at, { left: `${x * 100}%`, top: h / 2 - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: c.skeleton }]}
          />
        ))}
      </View>
      {variant === 'full' ? <View style={{ height: 20 }} /> : null}
    </View>
  );
}
