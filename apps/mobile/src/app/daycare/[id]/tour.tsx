import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { StickyBar } from '@/components/ui/Chrome';
import { PlaceSkeleton } from '@/components/ui/Skeletons';
import { Text } from '@/components/ui/Text';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { buildTourQuestions } from '@/lib/tour';
import { radius, space, useColors } from '@/theme';

export default function TourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const record = useDaycareRecord(Number(id));
  if (!record.data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <PlaceSkeleton heroHeight={0} />
      </View>
    );
  }

  const name = tidyCase(record.data.daycare.name);
  const questions = buildTourQuestions(record.data.findings);
  const hasSpecific = questions.some((q) => q.fact);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: space.xs }}>
          <Text variant="display" accessibilityRole="header">
            Ask {name}
          </Text>
          <Text variant="callout" tone="secondary">
            {hasSpecific ? 'From what inspectors found here in the last 2 years.' : 'No findings posted here in 2 years. Good at any daycare.'}
          </Text>
        </View>

        {questions.map((q, i) => (
          <View
            key={i}
            style={[styles.card, { backgroundColor: c.sunken }]}
            accessible
            accessibilityLabel={`Question ${i + 1}: ${q.question} ${q.fact ?? ''} ${q.followUp ?? ''}`}
          >
            <Text variant="caption" tone="tertiary" tabular>
              {i + 1}
            </Text>
            <Text variant="headline">{q.question}</Text>
            {q.fact ? (
              <Text variant="footnote" tone="secondary">
                {q.fact}
              </Text>
            ) : null}
            {q.followUp ? (
              <Text variant="callout" tone="secondary">
                {q.followUp}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <StickyBar>
        <Button
          label="Share these questions"
          kind="ink"
          icon="share"
          style={{ flex: 1 }}
          onPress={() =>
            void Share.share({
              message: [`Questions for ${name}`, '', ...questions.map((q, i) => `${i + 1}. ${q.question}${q.followUp ? ` ${q.followUp}` : ''}`)].join('\n'),
            })
          }
        />
      </StickyBar>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: 10, paddingBottom: space.section },
  card: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
});
