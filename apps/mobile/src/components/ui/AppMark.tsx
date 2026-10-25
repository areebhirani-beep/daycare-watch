import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Mask, Path, Rect } from 'react-native-svg';

import { useColors } from '@/theme';

/**
 * The app mark (same drawing as the app icon): a building with its door, and one dot at the corner for
 * something new the state posted about it. The door and the dot's gap are cut out, so it sits on photos too.
 * `width` is the whole mark; it is square.
 */
export function AppMark({ width = 44, color }: { width?: number; color?: string; background?: string }) {
  const c = useColors();
  const ink = color ?? c.text;
  const cut = `cut${useId().replace(/:/g, '')}`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Daycare Watch" style={{ width, height: width }}>
      <Svg width={width} height={width} viewBox="210 202 624 624">
        <Defs>
          <Mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
            <Rect width="1024" height="1024" fill="#FFFFFF" />
            <Rect x="412" y="628" width="120" height="200" rx="18" fill="#000000" />
            <Circle cx="724" cy="300" r="140" fill="#000000" />
          </Mask>
        </Defs>
        <Path d="M262 786 V494 L472 320 L682 494 V786 Z" fill={ink} stroke={ink} strokeWidth={78} strokeLinejoin="round" mask={`url(#${cut})`} />
        <Circle cx="724" cy="300" r="98" fill={ink} />
      </Svg>
    </View>
  );
}
