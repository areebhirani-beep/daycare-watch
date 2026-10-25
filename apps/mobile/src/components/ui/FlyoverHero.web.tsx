import { StyleSheet, View, type ViewStyle } from 'react-native';

import { MapSnapshot } from './MapSnapshot';

export { flyoverAllowed } from './flyover';

/** Web has no 3D view: the still aerial with our pin, credited by MapSnapshot. Same props as the native hero. */
export function FlyoverHero({
  lat,
  lng,
  pin = true,
  watched,
  style,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  legalTop?: number;
  /** Native only: the still aerial has nothing to re-centre. */
  bottomInset?: number;
  pin?: boolean;
  watched?: boolean;
  style?: ViewStyle;
}) {
  if (lat == null || lng == null) return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0B0C' }, style]} />;
  return <MapSnapshot lat={lat} lng={lng} zoom={17} showPin={pin} watched={watched} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, ...style }} />;
}
