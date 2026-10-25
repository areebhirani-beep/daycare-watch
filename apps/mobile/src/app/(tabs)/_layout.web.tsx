import { Redirect, usePathname } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { type ComponentRef, forwardRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Glyph, type GlyphName } from '@/components/ui/Glyph';
import { hasOnboarded } from '@/components/ui/onboarding';
import { Text } from '@/components/ui/Text';
import { inFrame } from '@/lib/layout';
import { useColors } from '@/theme';

/**
 * The web build's tabs. expo-router's native tabs draw a small text menu at the top of a browser window; this is the
 * iPhone's bar instead (icon over label, three equal tabs in a capsule at the bottom), so the web app, framed or on
 * a phone, looks like the app it is. Same tabs and order as _layout.tsx.
 */
export default function TabsLayout() {
  const c = useColors();
  const path = usePathname();
  // On the web a shared link (a judge, a parent) opens the page it names; onboarding only greets the front door.
  if (!hasOnboarded() && path === '/') return <Redirect href="/onboarding" />;
  return (
    <Tabs style={{ flex: 1, backgroundColor: c.bg }}>
      <TabSlot style={{ flex: 1 }} />
      {/* Tabs finds its list among its direct children, and the list its triggers. Inside the frame the bar clears
          the drawn home indicator, as on the iPhone. */}
      <TabList style={[styles.capsule, { marginBottom: inFrame ? 26 : 12, backgroundColor: c.surface, borderColor: c.hairline }]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton icon="map" label="Find" />
        </TabTrigger>
        <TabTrigger name="watching" href="/watching" asChild>
          <TabButton icon="bell" label="Watching" />
        </TabTrigger>
        <TabTrigger name="rights" href="/rights" asChild>
          <TabButton icon="doc" label="Your rights" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: GlyphName; label: string };

// The active tab is an ink pill with its label in the page colour (white pill in dark mode); the others are grey.
const TabButton = forwardRef<ComponentRef<typeof Pressable>, TabButtonProps>(function TabButton({ icon, label, isFocused, ...props }, ref) {
  const c = useColors();
  const fg = isFocused ? c.onInk : c.textSecondary;
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      aria-selected={isFocused}
      accessibilityLabel={label}
      // asChild merges styles as objects, so this one is flat.
      style={StyleSheet.flatten([styles.tab, isFocused && { backgroundColor: c.ink }])}
    >
      <Glyph name={icon} size={22} color={fg} />
      <Text variant="caption" color={fg} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  capsule: { flexDirection: 'row', height: 64, marginHorizontal: 16, marginTop: 8, padding: 4, borderRadius: 32, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 28 },
  label: { fontSize: 11, lineHeight: 13, fontWeight: '600' },
});
