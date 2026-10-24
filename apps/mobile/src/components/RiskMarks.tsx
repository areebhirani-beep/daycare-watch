import { StyleSheet, View } from 'react-native';

import { riskRank, type RiskLevel, useColors } from '@/theme';

/**
 * Five small bars, filled up to the state's risk level (Low = 1 … High = 5).
 * Rank is readable from the count of filled bars alone, so color is never the only signal.
 * Decorative: the adjacent text always says the level in words.
 */
export function RiskMarks({ level }: { level: RiskLevel }) {
  const c = useColors();
  const rank = riskRank[level];
  const tint = c.risk[level];
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: 6 + i * 2 },
            i <= rank ? { backgroundColor: tint } : { borderColor: c.border, borderWidth: 1 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 },
  bar: { width: 4, borderRadius: 1 },
});
