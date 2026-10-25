import { StyleSheet, View } from 'react-native';

import { categoryLabel } from '@/lib/format';
import { elevation, space, useColors } from '@/theme';

import { CATEGORY_MEANING, CATEGORY_ORDER, CategoryIcon } from './CategoryIcon';
import { Text } from './Text';

/**
 * "What the categories mean": the nine kinds of rule, each with its disc and one plain line. Opened on
 * request from a category label, never shown as a legend on the record itself.
 */
export function CategoryGuide() {
  const c = useColors();
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="title" accessibilityRole="header">
          What the categories mean
        </Text>
        <Text variant="callout" tone="secondary">
          Every problem the state cites is under a rule, and we group the rules into nine kinds. The color only tells the kinds apart. It never means better or worse.
        </Text>
      </View>
      <View style={[styles.card, elevation.card, { backgroundColor: c.surface }]}>
        {CATEGORY_ORDER.map((k, i) => (
          <View
            key={k}
            accessible
            accessibilityLabel={`${categoryLabel(k)}. ${CATEGORY_MEANING[k]}`}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline }]}
          >
            <CategoryIcon category={k} size={36} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{categoryLabel(k)}</Text>
              <Text variant="callout" tone="secondary">
                {CATEGORY_MEANING[k]}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text variant="footnote" tone="tertiary">
        We sort each finding by the rule the state cited (its number and title), with fixed rules and no guessing.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
});
