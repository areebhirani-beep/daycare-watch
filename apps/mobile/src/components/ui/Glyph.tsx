import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useColors } from '@/theme';

import './iconFont';

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
  video: { ios: 'video.fill', android: 'videocam' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  map: { ios: 'map.fill', android: 'map' },
  list: { ios: 'list.bullet', android: 'list' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'tune' },
  external: { ios: 'arrow.up.right', android: 'open_in_new' },
  photo: { ios: 'photo.on.rectangle', android: 'photo_library' },
  center: { ios: 'building.2.fill', android: 'apartment' },
  home: { ios: 'house.fill', android: 'home' },
  district: { ios: 'flag.fill', android: 'flag' },
  schoolAge: { ios: 'backpack.fill', android: 'backpack' },
  // One per state finding category (CategoryIcon).
  catSupervision: { ios: 'eye.fill', android: 'visibility' },
  catBackground: { ios: 'person.text.rectangle.fill', android: 'badge' },
  catRatio: { ios: 'person.3.fill', android: 'groups' },
  catHazard: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  catHealth: { ios: 'cross.case.fill', android: 'medical_services' },
  catDiscipline: { ios: 'hand.raised.fill', android: 'front_hand' },
  catParents: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum' },
  catPaperwork: { ios: 'doc.text.fill', android: 'description' },
  catOther: { ios: 'ellipsis', android: 'more_horiz' },
  grid: { ios: 'square.grid.2x2.fill', android: 'grid_view' },
  info: { ios: 'info.circle', android: 'info' },
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
      // Web reads `.web`; Material Symbols ships with the web build, so it reuses the Android names.
      name={{ ...GLYPHS[name], web: GLYPHS[name].android } as SymbolViewProps['name']}
      size={size}
      tintColor={color ?? c.text}
      weight={weight}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
