import { Stack } from 'expo-router';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { MapSnapshot } from '@/components/ui/MapSnapshot';
import { EXAMPLE_OPERATION_ID } from '@/components/ui/onboarding';
import { useDaycareRecord } from '@/lib/api';
import { elevation, useColors } from '@/theme';

/** Wider than this, the web build shows onboarding as a card over the place instead of a stretched phone screen. */
const CARD_FROM = 768;
const CARD_W = 480;
const CARD_MAX_H = 860;

export default function OnboardingLayout() {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const stack = <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
  if (Platform.OS !== 'web' || width < CARD_FROM) return stack;
  return <WideFrame height={height}>{stack}</WideFrame>;
}

/** The real example center from above fills the page; each step sits in a centred card on top of it. */
function WideFrame({ height, children }: { height: number; children: React.ReactNode }) {
  const c = useColors();
  const d = useDaycareRecord(EXAMPLE_OPERATION_ID).data?.daycare;
  return (
    <View style={[styles.page, { backgroundColor: '#0B0B0C' }]}>
      {d ? <MapSnapshot lat={d.lat} lng={d.lng} zoom={17} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} attributionInset={8} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
      <View style={[styles.card, elevation.float, { backgroundColor: c.bg, height: Math.min(CARD_MAX_H, height - 64) }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  card: { width: CARD_W, borderRadius: 28, overflow: 'hidden' },
});
