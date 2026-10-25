import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { hasOnboarded } from '@/components/ui/onboarding';
import { useColors } from '@/theme';

export default function TabsLayout() {
  const c = useColors();
  if (!hasOnboarded()) return <Redirect href="/onboarding" />;
  return (
    <NativeTabs backgroundColor={c.bg} tintColor={c.ink}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Find</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="watching">
        <NativeTabs.Trigger.Label>Watching</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bell', selected: 'bell.fill' }} md="notifications" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rights">
        <NativeTabs.Trigger.Label>Your rights</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="description" />
      </NativeTabs.Trigger>
      {/* District pulse is cut until a replayed push lands on a real phone (team decision, Oct 24). */}
      <NativeTabs.Trigger name="pulse" hidden>
        <NativeTabs.Trigger.Label>This week</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_today" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
