import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryGuide } from '@/components/ui/CategoryGuide';
import { space, useColors } from '@/theme';

/** "What the categories mean", opened from a record's Problems tab as a sheet over it. */
export default function CategoriesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + space.xl }}
    >
      <CategoryGuide />
    </ScrollView>
  );
}
