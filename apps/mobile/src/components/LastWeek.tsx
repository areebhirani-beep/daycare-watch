import { Pressable, StyleSheet, View } from 'react-native';

import { CATEGORY_ORDER, CategoryIcon, CategoryRow } from '@/components/ui/CategoryIcon';
import { SectionHeader } from '@/components/ui/Chrome';
import { Glyph } from '@/components/ui/Glyph';
import { pinKind } from '@/components/ui/MapPin';
import { Block } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/Icon';
import { useDistrictPulse, useDistrictRecentVisits } from '@/lib/api';
import { pulseLine, visitMeta, visitName, visitStatus } from '@/lib/feed';
import { todayIso } from '@/lib/format';
import type { Category, DistrictRecentVisit } from '@/lib/types';
import { haptic, space, useColors } from '@/theme';

const ROWS = 3;
const LEAD = 36;

/** The first category in the app's fixed order, so the same visit always leads with the same picture. */
function leadCategory(cats: (Category | null)[]): Category | null {
  return (CATEGORY_ORDER.find((k) => cats.includes(k as Category)) as Category | undefined) ?? null;
}

/**
 * "In TX-04 last week": the state's newest visits in the district, so the app shows something new each week.
 * District-wide and newest first, never "worst" or "most": three rows, each opening that daycare's record,
 * then "See all" for the rest of the week.
 */
export function LastWeek({ onOpen, onSeeAll }: { onOpen: (operationId: number) => void; onSeeAll?: () => void }) {
  const c = useColors();
  const pulse = useDistrictPulse();
  const visits = useDistrictRecentVisits(ROWS);
  const today = todayIso();

  // Nothing to say (no sync yet, or the RPC failed): leave the section out rather than show an empty box.
  if (pulse.isError || visits.isError || (pulse.isSuccess && !pulse.data) || (visits.isSuccess && visits.data.length === 0)) return null;
  const loading = !pulse.data || !visits.data;
  const total = pulse.data?.visits ?? 0;

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title="In TX-04 last week" detail={pulse.data ? pulseLine(pulse.data) : ' '} />
      <View>
        {loading
          ? Array.from({ length: ROWS }, (_, i) => <VisitSkeleton key={i} first={i === 0} />)
          : visits.data!.map((v, i) => <VisitRow key={v.activity_id} visit={v} first={i === 0} today={today} onOpen={onOpen} />)}
        {!loading && onSeeAll && total > visits.data!.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic.select();
              onSeeAll();
            }}
            style={({ pressed }) => [styles.more, { borderTopColor: c.hairline }, pressed && { opacity: 0.6 }]}
          >
            <Text variant="subhead" style={{ flex: 1 }}>
              See all {total} visits
            </Text>
            <Glyph name="chevronRight" size={13} color={c.textSecondary} weight="bold" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** One state visit: what was found (or what kind of place it is), name, city and date, and what's posted so far. */
export function VisitRow({
  visit: v,
  first,
  today,
  onOpen,
  lines = 2,
}: {
  visit: DistrictRecentVisit;
  first: boolean;
  today: string;
  onOpen: (operationId: number) => void;
  /** Name lines: two in the Home feed; the full week list passes 0 (no limit) so names stay whole. */
  lines?: number;
}) {
  const c = useColors();
  const lead = leadCategory(v.categories);
  return (
    <Pressable
      onPress={() => onOpen(v.operation_id)}
      accessibilityRole="button"
      accessibilityLabel={`${visitName(v)}. ${visitMeta(v, today)}. ${visitStatus(v)}.`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.sunken }]}
    >
      {!first ? <View style={[styles.divider, { backgroundColor: c.hairline }]} /> : null}
      {/* What the state found, as a picture; before anything is posted, just what kind of place it is. */}
      {lead ? (
        <CategoryIcon category={lead} size={LEAD} />
      ) : (
        <View style={[styles.lead, { backgroundColor: c.sunken }]}>
          <Glyph name={pinKind(v.operation_type)} size={16} color={c.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" numberOfLines={lines}>
          {visitName(v)}
        </Text>
        <Text variant="footnote" tone="secondary" tabular>
          {visitMeta(v, today)}
        </Text>
        <View style={styles.status}>
          {new Set(v.categories).size > 1 ? <CategoryRow categories={v.categories} size={20} max={3} /> : null}
          <Text variant="footnote" tone={v.findings_posted_so_far > 0 ? 'primary' : 'secondary'}>
            {visitStatus(v)}
          </Text>
        </View>
      </View>
      <Icon name="chevronRight" size={14} color={c.textTertiary} />
    </Pressable>
  );
}

export function VisitSkeleton({ first }: { first: boolean }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {!first ? <View style={[styles.divider, { backgroundColor: c.hairline }]} /> : null}
      <Block style={{ width: LEAD, height: LEAD, borderRadius: LEAD / 2 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <Block style={{ width: '60%', height: 16 }} />
        <Block style={{ width: '40%', height: 12 }} />
        <Block style={{ width: '50%', height: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, paddingHorizontal: space.lg, paddingVertical: space.md },
  // Hairline under the text column only, as in 'All nearby'.
  divider: { position: 'absolute', top: 0, right: 0, left: space.lg + LEAD + space.md, height: StyleSheet.hairlineWidth },
  lead: { width: LEAD, height: LEAD, borderRadius: LEAD / 2, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  // Same as the place page's 'See all' row.
  more: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
