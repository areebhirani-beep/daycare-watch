import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';

import { Glyph } from './Glyph';
import { Text } from './Text';

/**
 * Every daycare gets the same pin, so the map never ranks anyone. Ink disc with a white ring;
 * a watched daycare is school-bus yellow with a bell and an ink ring; the selected pin grows.
 */
export function MapPin({ watched, selected }: { watched?: boolean; selected?: boolean }) {
  const c = useColors();
  const size = selected ? 40 : 26;
  return (
    <View
      style={[
        styles.pin,
        pinShadow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: selected ? 4 : 3,
          backgroundColor: watched ? c.mapPinWatched : c.ink,
          ...(watched ? { borderColor: c.ink } : null),
        },
      ]}
    >
      {watched ? (
        <Glyph name="bellFill" size={selected ? 16 : 11} color={c.onSignal} weight="bold" />
      ) : (
        <View style={{ width: selected ? 12 : 8, height: selected ? 12 : 8, borderRadius: 6, backgroundColor: c.onInk }} />
      )}
    </View>
  );
}

/** A group of nearby daycares. The count is tabular and heavy, like every number in the app. */
export function ClusterBubble({ count }: { count: number }) {
  const c = useColors();
  const size = count >= 100 ? 52 : count >= 10 ? 44 : 38;
  return (
    <View
      accessible
      accessibilityLabel={`${count} daycares here`}
      style={[styles.pin, pinShadow, { width: size, height: size, borderRadius: size / 2, borderWidth: 3, backgroundColor: c.ink }]}
    >
      <Text variant="subhead" tone="onInk" tabular style={{ fontWeight: '800' }} maxFontSizeMultiplier={1}>
        {count >= 1000 ? `${Math.floor(count / 100) / 10}k` : String(count)}
      </Text>
    </View>
  );
}

const pinShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  pin: { alignItems: 'center', justifyContent: 'center', borderColor: '#FFFFFF' },
});
