import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useColors } from '@/theme';

// Meaning → platform symbol: SF Symbols on iOS, Material Symbols on Android.
const GLYPHS = {
  search: { ios: 'magnifyingglass', android: 'search' },
  locate: { ios: 'location.fill', android: 'my_location' },
  close: { ios: 'xmark', android: 'close' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  bell: { ios: 'bell', android: 'notifications' },
  bellFill: { ios: 'bell.fill', android: 'notifications_active' },
  check: { ios: 'checkmark', android: 'check' },
  ages: { ios: 'figure.and.child.holdinghands', android: 'family_restroom' },
  capacity: { ios: 'person.2.fill', android: 'group' },
  clock: { ios: 'clock.fill', android: 'schedule' },
  subsidy: { ios: 'dollarsign.circle.fill', android: 'paid' },
  phone: { ios: 'phone.fill', android: 'call' },
  directions: { ios: 'arrow.triangle.turn.up.right.diamond.fill', android: 'directions' },
  record: { ios: 'building.columns.fill', android: 'account_balance' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  doc: { ios: 'doc.text.fill', android: 'description' },
  shield: { ios: 'checkmark.shield.fill', android: 'verified_user' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  map: { ios: 'map.fill', android: 'map' },
  list: { ios: 'list.bullet', android: 'list' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'tune' },
  external: { ios: 'arrow.up.right', android: 'open_in_new' },
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({
  name,
  size = 17,
  color,
  weight = 'semibold',
}: {
  name: GlyphName;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
}) {
  const c = useColors();
  return (
    <SymbolView
      name={GLYPHS[name] as SymbolViewProps['name']}
      size={size}
      tintColor={color ?? c.text}
      weight={weight}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
