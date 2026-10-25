import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadError } from '@/components/LoadError';
import { VisitRow, VisitSkeleton } from '@/components/LastWeek';
import { Text } from '@/components/ui/Text';
import { useDistrictPulse, useDistrictRecentVisits } from '@/lib/api';
import { pulseLine, weekVisits } from '@/lib/feed';
import { todayIso } from '@/lib/format';
import { space, useColors } from '@/theme';

// The RPC's ceiling; a TX-04 week has been 10 to 20 visits.
const MAX = 50;

/** Every state visit in TX-04 last week, newest first, each opening that daycare's record. */
export default function WeekScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pulse = useDistrictPulse();
  const visits = useDistrictRecentVisits(MAX);
  const today = todayIso();
  const rows = pulse.data && visits.data ? weekVisits(visits.data, pulse.data) : null;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md }}>
        <Text variant="callout" tone="secondary">
          {pulse.data ? pulseLine(pulse.data) : ' '}
        </Text>
      </View>
      {pulse.isError || visits.isError ? (
        <LoadError
          onRetry={() => {
            void pulse.refetch();
            void visits.refetch();
          }}
        />
      ) : !rows ? (
        Array.from({ length: 6 }, (_, i) => <VisitSkeleton key={i} first={i === 0} />)
      ) : (
        <>
          {rows.map((v, i) => (
            <VisitRow
              key={v.activity_id}
              visit={v}
              first={i === 0}
              today={today}
              lines={0}
              onOpen={(id) => router.push(`/daycare/${id}`)}
            />
          ))}
          {pulse.data && rows.length < pulse.data.visits ? (
            <Text variant="footnote" tone="secondary" style={{ padding: space.lg }}>
              Showing the newest {rows.length} of {pulse.data.visits} visits.
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
