import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useColors } from '@/theme';

// One place maps meaning → platform symbol, so iOS gets SF Symbols and Android gets Material Symbols.
const ICONS = {
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more' },
  external: { ios: 'arrow.up.right', android: 'open_in_new' },
  check: { ios: 'checkmark', android: 'check' },
  bell: { ios: 'bell', android: 'notifications' },
  bellFill: { ios: 'bell.fill', android: 'notifications_active' },
  search: { ios: 'magnifyingglass', android: 'search' },
  location: { ios: 'location', android: 'near_me' },
  close: { ios: 'xmark', android: 'close' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  phone: { ios: 'phone', android: 'call' },
  doc: { ios: 'doc.text', android: 'description' },
  list: { ios: 'list.bullet', android: 'list' },
  map: { ios: 'map', android: 'map' },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 17,
  color,
  weight = 'medium',
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
}) {
  const c = useColors();
  return (
    <SymbolView
      // expo-symbols on web reads a 'web' key; it takes the Material names.
      name={{ ...ICONS[name], web: ICONS[name].android } as SymbolViewProps['name']}
      size={size}
      tintColor={color ?? c.textSecondary}
      weight={weight}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
