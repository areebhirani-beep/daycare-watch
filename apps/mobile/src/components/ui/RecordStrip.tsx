import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { isFixed, parseDay } from '@/lib/format';
import { groupByVisit } from '@/lib/record';
import type { DaycareRecord } from '@/lib/types';
import { type Colors, haptic, type RiskLevel, riskRank, useColors } from '@/theme';

import { Text as T } from './Text';

/**
 * The record strip: every state visit in a window, drawn where it happened in time.
 * A visit with findings is a stack of marks, one per finding, the higher-risk rules at the bottom.
 * A solid mark was corrected at the inspection or verified fixed by the state; an outlined mark
 * is not yet verified. A dot on the line is a visit with no findings posted.
 * It shows counts and dates only. It is never a grade.
 */

export type Rank = 1 | 2 | 3 | 4 | 5;
export type StripMark = { rank: Rank; open: boolean };
export type StripVisit = { id: string | number; date: string; marks: StripMark[]; pending?: boolean };

/** One entry of DaycareRow.visits_24mo (platform, oldest first). r = risk ranks desc, o = 1 when not yet verified. */
export type RowVisit = { d: string; n?: number; r: number[]; o: number[] };

const LEVEL_BY_RANK: Record<Rank, RiskLevel> = { 5: 'High', 4: 'Medium High', 3: 'Medium', 2: 'Medium Low', 1: 'Low' };

function toRank(n: number): Rank {
  return (n >= 5 ? 5 : n <= 1 ? 1 : Math.round(n)) as Rank;
}

function sortMarks(marks: StripMark[]): StripMark[] {
  return [...marks].sort((a, b) => b.rank - a.rank || Number(b.open) - Number(a.open));
}

/** From a full daycare_record payload. */
export function stripFromRecord(record: Pick<DaycareRecord, 'findings' | 'inspections'>): StripVisit[] {
  return groupByVisit(record).map((v) => ({
    id: v.activity_id,
    date: v.date,
    pending: v.status === 'pending',
    marks: sortMarks(v.findings.map((f) => ({ rank: riskRank[f.risk_level], open: !isFixed(f) }))),
  }));
}

/** From the compact per-row summary (DaycareRow.visits_24mo). */
export function stripFromRow(visits: RowVisit[] | null | undefined): StripVisit[] {
  return (visits ?? []).map((v, i) => ({
    id: `${v.d}-${i}`,
    date: v.d,
    marks: sortMarks(v.r.map((r, j) => ({ rank: toRank(r), open: v.o[j] === 1 }))),
  }));
}

function dayValue(iso: string): number | null {
  const p = parseDay(iso);
  return p ? new Date(p.y, p.m, p.d).getTime() : null;
}

/** Spoken summary, so a screen reader gets the whole picture in one sentence. */
export function stripSentence(visits: StripVisit[], months: number): string {
  const all = visits.flatMap((v) => v.marks);
  const withFindings = visits.filter((v) => v.marks.length > 0).length;
  const high = all.filter((m) => m.rank === 5).length;
  const open = all.filter((m) => m.open).length;
  if (visits.length === 0) return `No state visits posted in the last ${months} months.`;
  const parts = [`${visits.length} state ${visits.length === 1 ? 'visit' : 'visits'} in the last ${months} months.`];
  if (all.length === 0) parts.push('No findings posted.');
  else {
    parts.push(`${all.length} ${all.length === 1 ? 'finding' : 'findings'} from ${withFindings} ${withFindings === 1 ? 'visit' : 'visits'}.`);
    if (high > 0) parts.push(`${high} on a High risk rule.`);
    if (open > 0) parts.push(`${open} not yet verified by the state.`);
  }
  return parts.join(' ');
}

type Geometry = { col: number; mark: number; step: number; cap: number; dot: number; minRows: number };

const FULL: Geometry = { col: 14, mark: 10, step: 13, cap: 9, dot: 6, minRows: 4 };
const HERO: Geometry = { col: 20, mark: 14, step: 18, cap: 8, dot: 8, minRows: 5 };
const COMPACT: Geometry = { col: 8, mark: 6, step: 8, cap: 5, dot: 4, minRows: 4 };
const COL_GAP = 2;
// Axis labels sit under fixed-size marks, so they grow with Dynamic Type only this far.
const AXIS_MAX_SCALE = 1.35;

type Placed = StripVisit & { x: number; t: number };

function place(visits: StripVisit[], width: number, start: number, end: number, col: number): { placed: Placed[]; col: number } {
  const dated = visits
    .map((v) => ({ ...v, t: dayValue(v.date) ?? Number.NaN }))
    .filter((v) => v.t >= start && v.t <= end)
    .sort((a, b) => a.t - b.t);
  // Narrow the columns when a busy record would not fit side by side.
  const fit = dated.length > 0 ? Math.floor(width / dated.length) - COL_GAP : col;
  const w = Math.max(2, Math.min(col, fit));
  const span = Math.max(1, width - w);
  const placed: Placed[] = dated.map((v) => ({ ...v, x: ((v.t - start) / (end - start)) * span }));
  for (let i = 1; i < placed.length; i++) {
    const prev = placed[i - 1]!;
    placed[i]!.x = Math.max(placed[i]!.x, prev.x + w + COL_GAP);
  }
  for (let i = placed.length - 1; i >= 0; i--) {
    const limit = i === placed.length - 1 ? span : placed[i + 1]!.x - w - COL_GAP;
    placed[i]!.x = Math.max(0, Math.min(placed[i]!.x, limit));
  }
  return { placed, col: w };
}

function Mark({ mark, w, h, c }: { mark: StripMark; w: number; h: number; c: Colors }) {
  const tint = c.risk[LEVEL_BY_RANK[mark.rank]];
  return (
    <View
      style={[
        { width: w, height: h, borderRadius: Math.min(w, h) / 3 },
        mark.open ? { borderWidth: w > 6 ? 2 : 1.25, borderColor: tint } : { backgroundColor: tint },
      ]}
    />
  );
}

type Props = {
  visits: StripVisit[];
  /** full: record page, with time axis and key. hero: onboarding, larger marks. compact: list rows and the map callout. */
  variant?: 'full' | 'hero' | 'compact';
  months?: number;
  now?: Date;
  onPressVisit?: (id: StripVisit['id']) => void;
  selectedId?: StripVisit['id'] | null;
  showKey?: boolean;
  /** compact only: a quiet '24 months' / 'Today' line under the strip, for the callout and Watching. */
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

  const { placed, col } = useMemo(() => place(visits, width, start, end, g.col), [visits, width, start, end, g.col]);
  const tallest = placed.reduce((m, v) => Math.max(m, v.marks.length), 0);
  const overflow = tallest > g.cap;
  const rows = Math.max(g.minRows, Math.min(g.cap, tallest));
  const plotH = rows * g.step + (overflow && isFull ? 16 : 0);
  const sentence = stripSentence(placed, months);

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
      <View onLayout={onLayout} style={{ height: plotH + 1 }}>
        {width > 0 &&
          placed.map((v, i) => {
            const shown = v.marks.slice(0, g.cap);
            const hidden = v.marks.length - shown.length;
            const selected = selectedId != null && selectedId === v.id;
            const column = (left: number) => (
              <Animated.View
                entering={FadeInDown.delay(Math.min(i, 30) * 18)
                  .duration(240)
                  .reduceMotion(ReduceMotion.System)}
                style={[styles.column, { left, width: col, gap: g.step - g.mark }]}
              >
                {shown.length === 0 ? (
                  <View
                    style={[
                      { width: g.dot, height: g.dot, borderRadius: g.dot / 2, alignSelf: 'center' },
                      v.pending
                        ? { borderWidth: 1, borderColor: c.textTertiary }
                        : { backgroundColor: c.textTertiary },
                    ]}
                  />
                ) : (
                  shown.map((m, j) => <Mark key={j} mark={m} w={col} h={g.mark} c={c} />)
                )}
                {hidden > 0 && isFull ? (
                  <T variant="caption" tone="secondary" tabular style={styles.more} numberOfLines={1}>
                    {`+${hidden}`}
                  </T>
                ) : null}
              </Animated.View>
            );
            // A selected visit is underlined whether or not the strip is tappable (the alert highlights its visit).
            if (!onPressVisit || !isFull)
              return (
                <View key={String(v.id)} style={StyleSheet.absoluteFill} pointerEvents="none">
                  {column(v.x)}
                  {selected ? <View style={[styles.selected, { left: v.x, width: col, backgroundColor: c.accent }]} /> : null}
                </View>
              );
            return (
              <Pressable
                key={String(v.id)}
                accessible={false}
                hitSlop={{ top: 8, bottom: 16, left: 4, right: 4 }}
                onPress={() => {
                  haptic.select();
                  onPressVisit(v.id);
                }}
                style={[styles.hit, { left: v.x - 4, width: col + 8, height: plotH }]}
              >
                <View style={{ position: 'absolute', left: 4, bottom: 0, width: col, height: plotH }}>{column(0)}</View>
                {selected ? <View style={[styles.selected, { left: 4, width: col, backgroundColor: c.accent }]} /> : null}
              </Pressable>
            );
          })}
        <View style={[styles.baseline, { backgroundColor: c.border }]} />
      </View>

      {isFull ? (
        <View style={styles.axis}>
          <T variant="caption" tone="tertiary" maxFontSizeMultiplier={AXIS_MAX_SCALE} tabular>
            {startLabel}
          </T>
          {years.map((y) => (
            <View key={y.label} style={[styles.yearTick, { left: y.x }]}>
              <View style={{ width: StyleSheet.hairlineWidth * 2, height: 6, backgroundColor: c.textTertiary }} />
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

      {isFull && showKey ? <StripKey /> : null}
    </View>
  );
}

/** The three-item key under the full strip. Words carry the meaning; the swatches only point at it. */
export function StripKey() {
  const c = useColors();
  const ranks: Rank[] = [1, 2, 3, 4, 5];
  return (
    <View style={styles.key} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.keyItem}>
        <View style={styles.keyRamp}>
          {ranks.map((r) => (
            <View key={r} style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: c.risk[LEVEL_BY_RANK[r]] }} />
          ))}
        </View>
        <T variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
          One finding, by rule risk Low to High
        </T>
      </View>
      <View style={styles.keyItem}>
        <View style={{ width: 9, height: 9, borderRadius: 3, borderWidth: 2, borderColor: c.textSecondary }} />
        <T variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
          Not yet verified by the state
        </T>
      </View>
      <View style={styles.keyItem}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.textTertiary, marginHorizontal: 1 }} />
        <T variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
          Visit with no findings posted
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', bottom: 2, flexDirection: 'column-reverse', alignItems: 'stretch' },
  hit: { position: 'absolute', bottom: 0 },
  selected: { position: 'absolute', bottom: -7, height: 3, borderRadius: 1.5 },
  more: { position: 'absolute', top: -16, left: -10, right: -10, textAlign: 'center' },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1 },
  axis: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', minHeight: 16 },
  yearTick: { position: 'absolute', top: -6, alignItems: 'center', transform: [{ translateX: -30 }], width: 60 },
  key: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '100%' },
  keyRamp: { flexDirection: 'row', gap: 2 },
});

/** Loading state in the strip's own shape: a baseline and a few quiet columns, no shimmer. */
export function StripSkeleton({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const c = useColors();
  const g = variant === 'full' ? FULL : COMPACT;
  const cols = [0.08, 0.3, 0.52, 0.7, 0.93];
  const heights = [2, 1, 3, 1, 2];
  return (
    <View
      accessibilityLabel="Loading the state record"
      style={{ height: g.minRows * g.step + 1 + (variant === 'full' ? 22 : 0) }}
    >
      <View style={{ flex: 1 }}>
        {cols.map((x, i) => (
          <View
            key={i}
            style={[
              styles.column,
              { left: `${x * 100}%`, width: g.col, height: heights[i]! * g.step - (g.step - g.mark) },
              { backgroundColor: c.skeleton, borderRadius: 3 },
            ]}
          />
        ))}
        <View style={[styles.baseline, { backgroundColor: c.skeleton }]} />
      </View>
      {variant === 'full' ? <View style={{ height: 22 }} /> : null}
    </View>
  );
}
