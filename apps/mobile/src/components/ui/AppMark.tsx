import { View } from 'react-native';

import { useColors } from '@/theme';

/**
 * The app mark (same drawing as the app icon): one visit on the rail. An ink ring
 * with a solid centre sits on a time line, an earlier visit to its left. It reads as a visit and as an eye.
 * `width` is the whole mark; the height follows (0.59 of it).
 */
export function AppMark({ width = 72, color, background }: { width?: number; color?: string; background?: string }) {
  const c = useColors();
  const ink = color ?? c.text;
  const bg = background ?? c.surface;
  const u = width / 724;
  const H = 428 * u;
  const mid = H / 2;
  const R = 214 * u;
  const st = 58 * u;
  const dot = 58 * u;
  const pupil = 84 * u;
  const line = 34 * u;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Daycare Watch" style={{ width, height: H }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: mid - line / 2, height: line, borderRadius: line / 2, backgroundColor: ink }} />
      <View style={{ position: 'absolute', left: 100 * u - dot, top: mid - dot, width: dot * 2, height: dot * 2, borderRadius: dot, backgroundColor: ink }} />
      <View
        style={{
          position: 'absolute',
          left: 440 * u - R,
          top: mid - R,
          width: R * 2,
          height: R * 2,
          borderRadius: R,
          borderWidth: st,
          borderColor: ink,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: pupil * 2, height: pupil * 2, borderRadius: pupil, backgroundColor: ink }} />
      </View>
    </View>
  );
}
