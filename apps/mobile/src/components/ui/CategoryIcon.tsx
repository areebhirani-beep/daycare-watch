import { StyleSheet, View } from 'react-native';

import { CATEGORY_LABEL } from '@/lib/format';
import type { Category } from '@/lib/types';
import { type CategoryKey, useColors } from '@/theme';

import { Glyph, type GlyphName } from './Glyph';

/**
 * What each state finding category looks like: one symbol in a tinted disc, like a Google Maps
 * category pin or a DoorDash cuisine tile. The hue says which kind of rule, never how bad it was.
 */
export const CATEGORY_GLYPH: Record<CategoryKey, GlyphName> = {
  supervision: 'catSupervision',
  staff_ratio: 'catRatio',
  background_checks: 'catBackground',
  safety_hazards: 'catHazard',
  health_medication: 'catHealth',
  discipline: 'catDiscipline',
  parent_communication: 'catParents',
  paperwork_admin: 'catPaperwork',
  other: 'catOther',
};

/** One plain line per category, for the "What the categories mean" sheet. */
export const CATEGORY_MEANING: Record<CategoryKey, string> = {
  supervision: 'Watching the children: who was where, and whether an adult could see them.',
  staff_ratio: 'How many adults there were for the number of children in a room.',
  background_checks: 'Whether staff had the state’s required background checks on file.',
  safety_hazards: 'Things in the building or yard that could hurt a child, like gates, cords or chemicals.',
  health_medication: 'Medicine, allergies, sickness, cleaning and food handling.',
  discipline: 'How staff corrected children’s behavior.',
  parent_communication: 'What the daycare must tell parents, and when.',
  paperwork_admin: 'Forms and records the state requires the daycare to keep.',
  other: 'Rules that don’t fit the groups above.',
};

export const CATEGORY_ORDER: CategoryKey[] = [
  'supervision',
  'staff_ratio',
  'safety_hazards',
  'health_medication',
  'discipline',
  'background_checks',
  'parent_communication',
  'paperwork_admin',
  'other',
];

function key(c: Category | null | undefined): CategoryKey {
  return c && c in CATEGORY_GLYPH ? (c as CategoryKey) : 'other';
}

/** The tinted disc. `size` is the disc; the glyph is a little under half of it. */
export function CategoryIcon({ category, size = 36 }: { category: Category | null | undefined; size?: number }) {
  const c = useColors();
  const k = key(category);
  const tint = c.cat[k];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={CATEGORY_LABEL[k]}
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint.bg }]}
    >
      <Glyph name={CATEGORY_GLYPH[k]} size={Math.round(size * 0.46)} color={tint.fg} weight="semibold" />
    </View>
  );
}

/**
 * The categories found at a visit, as a row of small overlapping discs (cards, rows, alerts).
 * Distinct categories in a fixed order, at most `max`, then a "+N" disc.
 */
export function CategoryRow({
  categories,
  size = 24,
  max = 4,
}: {
  categories: (Category | null | undefined)[];
  size?: number;
  max?: number;
}) {
  const c = useColors();
  const seen = new Set(categories.map(key));
  const keys = CATEGORY_ORDER.filter((k) => seen.has(k));
  if (keys.length === 0) return null;
  const shown = keys.slice(0, max);
  const more = keys.length - shown.length;
  return (
    <View
      accessible
      accessibilityLabel={`Kinds of problems: ${keys.map((k) => CATEGORY_LABEL[k]).join(', ')}`}
      style={styles.row}
    >
      {shown.map((k, i) => (
        <View key={k} style={[styles.ring, { marginLeft: i === 0 ? 0 : -size * 0.18, borderColor: c.surface, borderRadius: size }]}>
          <CategoryIcon category={k} size={size} />
        </View>
      ))}
      {more > 0 ? (
        <View
          style={[
            styles.ring,
            styles.disc,
            { marginLeft: -size * 0.18, width: size + 4, height: size + 4, borderRadius: size, borderColor: c.surface, backgroundColor: c.sunken },
          ]}
        >
          <Glyph name="catOther" size={Math.round(size * 0.46)} color={c.textSecondary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderWidth: 2 },
});
