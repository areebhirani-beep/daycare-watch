import { View } from 'react-native';

import { LoadError } from '@/components/LoadError';
import { AlertView } from '@/components/ui/AlertView';
import { EXAMPLE_OPERATION_ID } from '@/components/ui/onboarding';
import { byWeight } from '@/components/ui/PlacePage';
import { PlaceSkeleton } from '@/components/ui/Skeletons';
import { useDaycareRecord } from '@/lib/api';
import type { AlertDetail } from '@/lib/types';
import { useColors } from '@/theme';

// Viva World School's visit of Oct 5 2026: the visit the phone journey replays as a push.
const EXAMPLE_ACTIVITY_ID = 903987067;

/**
 * The web never signs in, so it has no alerts of its own (alert_detail answers only a phone that watches). This draws
 * the alert for one real visit from the public record alone, labelled as an example. Nothing was posted to anyone, so
 * it carries no posted date.
 */
export default function ExampleAlertScreen() {
  const c = useColors();
  const record = useDaycareRecord(EXAMPLE_OPERATION_ID);
  const finding = record.data?.findings.filter((f) => f.activity_id === EXAMPLE_ACTIVITY_ID).sort(byWeight)[0];
  if (!record.data || !finding) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {record.isError ? <LoadError onRetry={() => void record.refetch()} /> : <PlaceSkeleton heroHeight={0} />}
      </View>
    );
  }
  const a: AlertDetail = {
    event_id: 0,
    kind: 'new_violation',
    is_replay: true,
    detected_at: '',
    source_date: finding.date,
    operation_id: EXAMPLE_OPERATION_ID,
    daycare_name: record.data.daycare.name,
    before: null,
    after: null,
    finding,
  };
  return <AlertView a={a} record={record.data} replayLabel="Example: a replay of a real state record" />;
}
