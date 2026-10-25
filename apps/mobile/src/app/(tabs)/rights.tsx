import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/T';
import { RowLink, Rule } from '@/components/ui';
import { InspectorQuote, SectionHead } from '@/components/ui/Serif';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { FEDERAL_NOTE, LAW_CITE, LAW_NAME, LAW_SCOPE, requestText, type RequestKind, RIGHTS } from '@/lib/rights';
import { space, TAB_BAR_CLEARANCE, useColors } from '@/theme';

const REQUESTS: { kind: RequestKind; title: string; detail: string }[] = [
  { kind: 'records', title: 'Request records', detail: 'Your child’s records, inspection reports, policies, training' },
  { kind: 'video', title: 'Request to inspect video', detail: 'Only for an alleged abuse or neglect incident involving your child' },
  { kind: 'visit', title: 'Show your right to drop in', detail: 'A note citing the law, for the front desk' },
];

export default function RightsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { operationId } = useLocalSearchParams<{ operationId?: string }>();
  const record = useDaycareRecord(Number(operationId ?? 0));
  const daycare = operationId && record.data ? tidyCase(record.data.daycare.name) : null;

  async function share(kind: RequestKind) {
    const { subject, body } = requestText(kind, daycare);
    await Share.share({ title: subject, message: body }, { subject });
  }

  return (
    // The inset sits on the screen, not the content, so scrolled text never runs under the status bar.
    <ScrollView
      style={{ backgroundColor: c.bg, marginTop: insets.top }}
      contentContainerStyle={[styles.content, { paddingTop: space.md }]}
    >
      <View style={{ gap: space.sm }}>
        <T variant="largeTitle" accessibilityRole="header">
          Your rights
        </T>
        <T variant="callout" tone="secondary">
          Texas law gives you these rights at your child&rsquo;s daycare.
        </T>
      </View>

      <View style={styles.section}>
        <SectionHead title={daycare ? `Send a request to ${daycare}` : 'Send a request'} first />
        <View>
          {REQUESTS.map((r, i) => (
            <View key={r.kind}>
              {i > 0 ? <Rule /> : null}
              <RowLink
                flush
                title={r.title}
                detail={r.detail}
                accessibilityHint="Opens the share sheet with a ready-to-send letter citing the law"
                onPress={() => void share(r.kind)}
              />
            </View>
          ))}
        </View>
        <T variant="footnote" tone="tertiary">
          Each opens a letter that cites {LAW_CITE}. Fill in the bracketed parts, then send by text or email.
        </T>
      </View>

      <View style={styles.section}>
        <SectionHead title="What the law says" />
        {RIGHTS.map((r) => (
          <RightRow key={r.id} title={r.title} plain={r.plain} quote={r.quote} clause={r.clause} />
        ))}
      </View>

      <View style={styles.section}>
        <SectionHead title="Something wrong?" />
        <RowLink flush title="Report a concern to the state" detail="Official Texas channels" onPress={() => router.push('/report')} />
      </View>

      <View style={styles.section}>
        <SectionHead title="About the law" />
        <T variant="footnote" tone="secondary">
          {LAW_NAME}, {LAW_CITE}. {LAW_SCOPE}
        </T>
      </View>

      <View style={styles.section}>
        <SectionHead title="In Congress" />
        <T variant="callout" tone="secondary">
          {FEDERAL_NOTE}
        </T>
      </View>
    </ScrollView>
  );
}

function RightRow({ title, plain, quote, clause }: { title: string; plain: string; quote: string; clause: string }) {
  return (
    <View style={styles.right}>
      <T variant="headline">{title}</T>
      <T variant="callout" tone="secondary">
        {plain}
      </T>
      <InspectorQuote text={quote} source={`${LAW_CITE}${clause}`} label="The law’s words" />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: TAB_BAR_CLEARANCE },
  section: { gap: space.md },
  right: { paddingVertical: space.sm, gap: space.xs },
});
