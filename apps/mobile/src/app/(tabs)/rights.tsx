import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { T } from '@/components/T';
import { RowLink, Rule, SectionLabel, Surface } from '@/components/ui';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { FEDERAL_NOTE, LAW_CITE, LAW_NAME, LAW_SCOPE, requestText, type RequestKind, RIGHTS } from '@/lib/rights';
import { minTap, space, useColors } from '@/theme';

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
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}
    >
      <View style={{ gap: space.sm }}>
        <T variant="largeTitle" accessibilityRole="header">
          Your rights
        </T>
        <T variant="callout" tone="secondary">
          {LAW_NAME} gives parents these rights at Texas daycares. {LAW_SCOPE}
        </T>
      </View>

      <View style={styles.section}>
        <SectionLabel>{daycare ? `Send a request to ${daycare}` : 'Send a request'}</SectionLabel>
        <Surface>
          {REQUESTS.map((r, i) => (
            <View key={r.kind}>
              {i > 0 ? <Rule inset={space.xl} /> : null}
              <RowLink
                title={r.title}
                detail={r.detail}
                accessibilityHint="Opens the share sheet with a ready-to-send letter citing the law"
                onPress={() => void share(r.kind)}
              />
            </View>
          ))}
        </Surface>
        <T variant="footnote" tone="tertiary">
          Each opens a letter that cites {LAW_CITE}. Fill in the bracketed parts, then send by text or email.
        </T>
      </View>

      <View style={styles.section}>
        <SectionLabel>What the law says</SectionLabel>
        {RIGHTS.map((r) => (
          <RightRow key={r.id} title={r.title} plain={r.plain} quote={r.quote} clause={r.clause} />
        ))}
      </View>

      <View style={styles.section}>
        <SectionLabel>Something wrong?</SectionLabel>
        <Surface>
          <RowLink title="Report a concern to the state" detail="Official Texas channels" onPress={() => router.push('/report')} />
        </Surface>
      </View>

      <View style={styles.section}>
        <SectionLabel>In Congress</SectionLabel>
        <T variant="callout" tone="secondary">
          {FEDERAL_NOTE}
        </T>
      </View>
    </ScrollView>
  );
}

function RightRow({ title, plain, quote, clause }: { title: string; plain: string; quote: string; clause: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.right}>
      <T variant="headline">{title}</T>
      <T variant="callout" tone="secondary">
        {plain}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Hide the law’s wording' : 'Read the law’s wording'}
        onPress={() => setOpen((v) => !v)}
        style={styles.toggle}
      >
        <T variant="subhead" tone="accent">
          The law&rsquo;s words
        </T>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={12} color={c.accent} weight="semibold" />
        </View>
      </Pressable>
      {open ? (
        <View style={[styles.quote, { backgroundColor: c.sunken, borderLeftColor: c.border }]}>
          <T variant="callout" selectable>
            &ldquo;{quote}&rdquo;
          </T>
          <T variant="footnote" tone="secondary">
            {LAW_CITE}
            {clause}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: space.section },
  section: { paddingTop: space.xxl, gap: space.sm },
  right: { paddingVertical: space.sm, gap: space.xxs },
  toggle: { minHeight: minTap, flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, alignSelf: 'flex-start' },
  quote: { borderLeftWidth: 3, borderRadius: 6, padding: space.md, gap: space.xs },
});
