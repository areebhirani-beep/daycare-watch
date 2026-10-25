import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionPill } from '@/components/ui/Chrome';
import type { GlyphName } from '@/components/ui/Glyph';
import { SectionHead } from '@/components/ui/Prose';
import { RightCard } from '@/components/ui/RightCard';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { shareText } from '@/lib/share';
import { FEDERAL_NOTE, LAW_CITE, LAW_NAME, LAW_URL, lawCovers, NOT_COVERED, requestText, type RequestKind, RIGHTS } from '@/lib/rights';
import { radius, space, TAB_BAR_CLEARANCE, useColors } from '@/theme';

type Action = { request: RequestKind } | { route: '/report' } | { law: true };

// What tapping each right does: a ready-to-send letter, the official complaint channels, or the law itself.
const ACTIONS: Record<string, { icon: GlyphName; action: Action }> = {
  visit: { icon: 'clock', action: { request: 'visit' } },
  records: { icon: 'doc', action: { request: 'records' } },
  reports: { icon: 'record', action: { request: 'records' } },
  video: { icon: 'shield', action: { request: 'video' } },
  policies: { icon: 'list', action: { request: 'records' } },
  training: { icon: 'check', action: { request: 'records' } },
  complain: { icon: 'phone', action: { route: '/report' } },
  retaliation: { icon: 'external', action: { law: true } },
};

export default function RightsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { operationId } = useLocalSearchParams<{ operationId?: string }>();
  const record = useDaycareRecord(Number(operationId ?? 0));
  const daycare = operationId && record.data ? tidyCase(record.data.daycare.name) : null;
  const covered = !record.data || lawCovers(record.data.daycare.operation_type);

  function run(action: Action) {
    if ('request' in action) {
      const { subject, body } = requestText(action.request, daycare);
      shareText(subject, body);
    } else if ('route' in action) {
      router.push(action.route);
    } else {
      void WebBrowser.openBrowserAsync(LAW_URL);
    }
  }

  return (
    // The inset sits on the screen, not the content, so scrolled text never runs under the status bar.
    <ScrollView
      style={{ backgroundColor: c.bg, marginTop: insets.top }}
      contentContainerStyle={[styles.content, { paddingTop: space.md }]}
    >
      <View style={{ gap: space.xs }}>
        <Text variant="largeTitle" accessibilityRole="header">
          Your rights
        </Text>
        <Text variant="callout" tone="secondary">
          {daycare && covered ? `At ${daycare}, Texas law lets you:` : 'At most daycares, Texas law lets you:'}
        </Text>
        {!covered ? (
          <View style={[styles.note, { backgroundColor: c.sunken }]}>
            <Text variant="callout">
              {NOT_COVERED} {daycare} is a listed family home.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cards}>
        {RIGHTS.map((r) => {
          const mapped = ACTIONS[r.id] ?? { icon: 'doc' as const, action: { law: true as const } };
          // A listed family home isn't covered, so no letter citing the law: the card opens the law itself.
          const a = covered || !('request' in mapped.action) ? mapped : { ...mapped, action: { law: true as const } };
          const trailing = 'route' in a.action ? 'chevronRight' : 'law' in a.action ? 'external' : 'share';
          const hint =
            'route' in a.action
              ? 'Opens the official ways to report to the state'
              : 'law' in a.action
                ? 'Opens the law on the Texas Legislature site'
                : undefined;
          return (
            <RightCard
              key={r.id}
              icon={a.icon}
              title={r.title}
              detail={r.plain}
              trailing={trailing}
              hint={hint}
              onPress={() => run(a.action)}
            />
          );
        })}
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="footnote" tone="tertiary">
          {LAW_NAME}, {LAW_CITE}. Covers centers and licensed or registered homes, not listed family homes.
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <ActionPill icon="external" label="Read the law" onPress={() => run({ law: true })} />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionHead title="In Congress" />
        <Text variant="callout" tone="secondary">
          {FEDERAL_NOTE}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: TAB_BAR_CLEARANCE, gap: space.xl },
  cards: { gap: 10 },
  note: { borderRadius: radius.card, padding: space.lg, marginTop: space.sm },
});
