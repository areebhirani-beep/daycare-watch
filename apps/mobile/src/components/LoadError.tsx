import { type StyleProp, View, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { space } from '@/theme';

export const OFFLINE = 'We couldn’t reach the state records. Check your connection.';

/** What a list shows when its request failed: never an empty-state message that reads as "nothing here". */
export function LoadError({
  message = OFFLINE,
  onRetry,
  style,
}: {
  message?: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ padding: space.lg, gap: space.md }, style]} accessibilityLiveRegion="polite">
      <Text variant="callout" tone="secondary">
        {message}
      </Text>
      <Button label="Try again" kind="secondary" size="md" onPress={onRetry} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}
