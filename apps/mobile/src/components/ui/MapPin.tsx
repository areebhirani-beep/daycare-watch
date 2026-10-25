import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { useColors } from '@/theme';

import { Glyph, type GlyphName } from './Glyph';
import { Text } from './Text';

export type PinKind = 'center' | 'home' | 'schoolAge';

const KIND_GLYPH: Record<PinKind, GlyphName> = { center: 'center', home: 'home', schoolAge: 'schoolAge' };

/** Licensed Center → center, any home type → home. School-age-only centers can pass 'schoolAge'. */
export function pinKind(operationType: string | null | undefined): PinKind {
  return operationType === 'Licensed Center' ? 'center' : 'home';
}

/**
 * A daycare on the map (Google Maps / Uber). Every daycare gets the same white pin with its type
 * glyph, so the map never ranks anyone. Watched = school-bus yellow with a bell. Selected grows and
 * shows its name in an ink pill underneath. Only for an exact street-address location; anything
 * approximate (and every home daycare) uses `AreaPin`.
 */
export function MapPin({
  kind = 'center',
  watched,
  selected,
  label,
}: {
  kind?: PinKind;
  watched?: boolean;
  selected?: boolean;
  /** Shown under the pin only while selected. */
  label?: string;
}) {
  const c = useColors();
  const size = selected ? 44 : 30;
  const fill = watched ? c.mapPinWatched : '#FFFFFF';
  const glyph = watched ? c.onSignal : '#0B0B0C';
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.disc,
          pinShadow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: fill,
            borderWidth: selected ? 3 : 0,
            borderColor: '#0B0B0C',
          },
        ]}
      >
        <Glyph name={watched ? 'bellFill' : KIND_GLYPH[kind]} size={selected ? 20 : 14} color={glyph} weight="bold" />
      </View>
      {selected && label ? (
        <Animated.View entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)} style={[styles.pill, pinShadow]}>
          <Text variant="caption" color="#FFFFFF" numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {label}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * An approximate location: a translucent area with the type glyph, never a point. Used when the
 * state's address didn't geocode exactly, and always for home daycares (privacy rule: no point on
 * a family's house). Pair it with "Approximate location" in the sheet.
 */
export function AreaPin({ kind = 'home', watched, selected }: { kind?: PinKind; watched?: boolean; selected?: boolean }) {
  const c = useColors();
  const area = selected ? 72 : 52;
  const core = selected ? 28 : 22;
  const tone = watched ? c.mapPinWatched : '#0B0B0C';
  return (
    <View
      style={[
        styles.disc,
        {
          width: area,
          height: area,
          borderRadius: area / 2,
          backgroundColor: watched ? 'rgba(255,200,0,0.28)' : 'rgba(11,11,12,0.14)',
          borderWidth: 1.5,
          borderColor: watched ? 'rgba(209,158,0,0.9)' : 'rgba(11,11,12,0.35)',
        },
      ]}
    >
      <View style={[styles.disc, pinShadow, { width: core, height: core, borderRadius: core / 2, backgroundColor: watched ? tone : '#FFFFFF' }]}>
        <Glyph name={watched ? 'bellFill' : KIND_GLYPH[kind]} size={Math.round(core * 0.5)} color="#0B0B0C" weight="bold" />
      </View>
    </View>
  );
}

/** A group of nearby daycares. The count is tabular and heavy, like every number in the app. */
/** Selected = the spot the sheet is listing: 1.15x, with a text-color ring a 2 pt gap outside the white border. */
export function ClusterBubble({ count, selected }: { count: number; selected?: boolean }) {
  const c = useColors();
  const size = Math.round((count >= 100 ? 52 : count >= 10 ? 44 : 38) * (selected ? 1.15 : 1));
  const disc = (
    <View
      accessible
      accessibilityLabel={`${count} daycares here`}
      style={[styles.disc, pinShadow, { width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#0B0B0C' }]}
    >
      <Text variant="subhead" color="#FFFFFF" tabular style={{ fontWeight: '800' }} maxFontSizeMultiplier={1}>
        {count >= 1000 ? `${Math.floor(count / 100) / 10}k` : String(count)}
      </Text>
    </View>
  );
  return selected ? (
    <View style={{ borderRadius: size / 2 + 4, borderWidth: 2, borderColor: c.text, padding: 2 }}>{disc}</View>
  ) : (
    disc
  );
}

const pinShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.28,
  shadowRadius: 5,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    marginTop: 4,
    maxWidth: 168,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#0B0B0C',
  },
});
