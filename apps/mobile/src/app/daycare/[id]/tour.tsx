import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { RecordSkeleton } from '@/components/Skeleton';
import { T } from '@/components/T';
import { Button, Rule } from '@/components/ui';
import { useDaycareRecord } from '@/lib/api';
import { tidyCase } from '@/lib/format';
import { buildTourQuestions } from '@/lib/tour';
import { space, useColors } from '@/theme';

export default function TourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const record = useDaycareRecord(Number(id));
  if (!record.data) return <RecordSkeleton />;

  const name = tidyCase(record.data.daycare.name);
  const questions = buildTourQuestions(record.data.findings);
  const hasSpecific = questions.some((q) => q.fact);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <View style={{ gap: space.xs }}>
        <T variant="title" accessibilityRole="header">
          Questions for {name}
        </T>
        <T variant="callout" tone="secondary">
          {hasSpecific
            ? 'Built from what state inspectors found here in the last 2 years.'
            : 'The state posted no findings here in the last 2 years. These questions are good at any daycare.'}
        </T>
      </View>

      {questions.map((q, i) => (
        <View key={i}>
          {i > 0 ? <Rule /> : null}
          <View style={styles.q} accessible accessibilityLabel={`${q.fact ? `${q.fact} ` : ''}Ask: ${q.question} ${q.followUp ?? ''}`}>
            {q.fact ? (
              <T variant="footnote" tone="secondary">
                {q.fact}
              </T>
            ) : null}
            <T variant="headline">{q.question}</T>
            {q.followUp ? (
              <T variant="callout" tone="secondary">
                {q.followUp}
              </T>
            ) : null}
          </View>
        </View>
      ))}

      <Button
        label="Share these questions"
        kind="secondary"
        icon="share"
        onPress={() =>
          void Share.share({
            message: [`Questions for ${name}`, '', ...questions.map((q, i) => `${i + 1}. ${q.question}${q.followUp ? ` ${q.followUp}` : ''}`)].join('\n'),
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.md, paddingBottom: space.section },
  q: { paddingVertical: space.md, gap: space.xs },
});
