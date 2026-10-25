import { StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';

/** Onboarding progress, drawn in the record strip's own marks: solid for done, outlined for ahead. */
export function StepMarks({ step, of }: { step: number; of: number }) {
  const c = useColors();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${of}`}
      accessibilityValue={{ min: 1, max: of, now: step }}
    >
      {Array.from({ length: of }, (_, i) => (
        <View
          key={i}
          style={[
            styles.mark,
            i < step ? { backgroundColor: c.text } : { borderWidth: 1.5, borderColor: c.border },
            i === step - 1 && { width: 22 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  mark: { width: 8, height: 8, borderRadius: 1.5 },
});
