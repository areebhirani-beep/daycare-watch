import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { imageryAllowed } from '@/lib/imagery';
import { haptic, radius, space, useColors } from '@/theme';

import { Glyph } from './Glyph';
import { MapSnapshot } from './MapSnapshot';
import { RecordStrip, type StripVisit } from './RecordStrip';
import { Text } from './Text';

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

/** DoorDash store card: a real map of the place on top, bold name, one meta line, the record strip. */
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
  style,
}: Common & { width?: number | `${number}%`; style?: ViewStyle }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${meta}`}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      <View style={[styles.hero, { backgroundColor: c.sunken }]}>
        <MapSnapshot lat={lat} lng={lng} zoom={17} watched={watched} privateHome={!imageryAllowed(operationType)} style={StyleSheet.absoluteFill} />
        {onToggleWatch ? (
          <View style={styles.heroToggle}>
            <WatchToggle watched={watched} onPress={onToggleWatch} onImage />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text variant="headline" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1} tabular>
          {meta}
        </Text>
        <View style={styles.strip}>
          {strip ? (
            <RecordStrip visits={strip} variant="compact" />
          ) : fallback ? (
            <Text variant="footnote" tone="secondary" tabular>
              {fallback}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Dense list row (DoorDash list density): 64 map thumb, name, meta, strip, bell. */
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
        <Text variant="headline" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1} tabular>
          {meta}
        </Text>
        {strip ? (
          <View style={{ marginTop: 6 }}>
            <RecordStrip visits={strip} variant="compact" />
          </View>
        ) : fallback ? (
          <Text variant="footnote" tone="secondary" tabular>
            {fallback}
          </Text>
        ) : null}
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
  strip: { marginTop: space.sm, minHeight: 20, justifyContent: 'flex-end' },
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
