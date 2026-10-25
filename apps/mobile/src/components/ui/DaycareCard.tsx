import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { imageryAllowed } from '@/lib/imagery';
import { haptic, radius, space, useColors } from '@/theme';

import { formatDateShort, plural } from '@/lib/format';

import { Glyph } from './Glyph';
import { MapSnapshot } from './MapSnapshot';
import type { StripVisit } from './RecordStrip';
import { Text } from './Text';

/**
 * The card's record in words (hierarchy rule 4: content is the chart): what the state found at its most
 * recent visit. "3 problems found Oct 5 · 1 serious", "No problems cited Oct 5".
 */
export function recordLine(visits: StripVisit[]): { text: string; found: boolean } {
  const last = visits.reduce<StripVisit | null>((a, b) => (!a || b.date > a.date ? b : a), null);
  if (!last) return { text: 'No state visits posted in 2 years', found: false };
  const when = formatDateShort(last.date, new Date().toISOString().slice(0, 10));
  const n = last.marks.length;
  if (n === 0) return { text: `No problems cited ${when}`, found: false };
  const serious = last.marks.filter((m) => m.rank === 5).length;
  return { text: `${plural(n, 'problem')} found ${when}${serious > 0 ? ` · ${serious} serious` : ''}`, found: true };
}

function RecordLine({ strip, fallback }: { strip?: StripVisit[] | null; fallback?: string }) {
  const line = strip ? recordLine(strip) : fallback ? { text: fallback, found: false } : null;
  if (!line) return null;
  return (
    <Text variant="subhead" tone={line.found ? 'primary' : 'secondary'} numberOfLines={1} tabular>
      {line.text}
    </Text>
  );
}

type Common = {
  name: string;
  /** One line, dot-separated: "Licensed center · 1.2 mi · Visited Sep 12". */
  meta: string;
  lat: number | null;
  lng: number | null;
  /** Required: decides whether aerial imagery may show (homes are private residences, lib/imagery). */
  operationType: string | null;
  watched?: boolean;
  /** The 24-month record strip. Null when the row carries no per-visit summary. */
  strip?: StripVisit[] | null;
  /** Shown instead of the strip when there is none, e.g. "3 findings in 24 months". */
  fallback?: string;
  onPress: () => void;
  onToggleWatch?: () => void;
};

function WatchToggle({ watched, onPress, onImage }: { watched?: boolean; onPress: () => void; onImage?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={watched ? 'Watching. Stop watching' : 'Watch this daycare'}
      hitSlop={10}
      onPress={() => {
        haptic.heavy();
        onPress();
      }}
      style={[styles.toggle, onImage && { backgroundColor: c.surface, ...shadow }, watched && { backgroundColor: c.signal }]}
    >
      <Glyph name={watched ? 'bellFill' : 'bell'} size={16} color={watched ? c.onSignal : c.text} weight="bold" />
    </Pressable>
  );
}

/** DoorDash store card: a real map of the place on top, bold name, one meta line, the record in words. */
export function DaycareCard({
  name,
  meta,
  lat,
  lng,
  operationType,
  watched,
  strip,
  fallback,
  onPress,
  onToggleWatch,
  width = 280,
  heroRatio = 2,
  style,
}: Common & { width?: number | `${number}%`; heroRatio?: number; style?: ViewStyle }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${meta}`}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }, style]}
    >
      <View style={[styles.hero, { backgroundColor: c.sunken, aspectRatio: heroRatio }]}>
        <MapSnapshot lat={lat} lng={lng} zoom={17} watched={watched} privateHome={!imageryAllowed(operationType)} style={StyleSheet.absoluteFill} />
        {onToggleWatch ? (
          <View style={styles.heroToggle}>
            <WatchToggle watched={watched} onPress={onToggleWatch} onImage />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {/* Two lines so long state names stay whole; the minimum keeps a carousel's cards even. */}
        <Text variant="headline" numberOfLines={2} style={{ minHeight: 44 }}>
          {name}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1} tabular>
          {meta}
        </Text>
        <View style={styles.strip}>
          <RecordLine strip={strip} fallback={fallback} />
        </View>
      </View>
    </Pressable>
  );
}

/** Dense list row (DoorDash list density): 64 map thumb, name, meta, the record in words, bell. */
export function PlaceRow({
  name,
  meta,
  lat,
  lng,
  operationType,
  watched,
  strip,
  fallback,
  onPress,
  onToggleWatch,
  selected,
}: Common & { selected?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${meta}`}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: c.sunken },
        selected && { backgroundColor: c.accentSoft },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: c.sunken }]}>
        <MapSnapshot
          lat={lat}
          lng={lng}
          zoom={16}
          watched={watched}
          smallPin
          attribution="short"
          privateHome={!imageryAllowed(operationType)}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.rowBody}>
        <Text variant="headline" numberOfLines={2}>
          {name}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1} tabular>
          {meta}
        </Text>
        <View style={{ marginTop: 2 }}>
          <RecordLine strip={strip} fallback={fallback} />
        </View>
      </View>
      {onToggleWatch ? <WatchToggle watched={watched} onPress={onToggleWatch} /> : null}
      {selected !== undefined ? (
        <View style={[styles.radio, selected ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.border }]}>
          {selected ? <Glyph name="check" size={13} color={c.onAccent} weight="heavy" /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.14,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  hero: { aspectRatio: 2, borderRadius: radius.thumb, overflow: 'hidden' },
  heroToggle: { position: 'absolute', top: 10, right: 10 },
  body: { paddingTop: space.sm + 2, gap: 2 },
  strip: { marginTop: space.xs },
  toggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.thumb, overflow: 'hidden' },
  rowBody: { flex: 1, gap: 2 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
