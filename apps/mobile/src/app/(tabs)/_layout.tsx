import { NativeTabs } from 'expo-router/native-tabs';

import { font, useColors } from '@/theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    <NativeTabs
      backgroundColor={c.bg}
      tintColor={c.accent}
      labelStyle={{ fontFamily: font.medium }}
    >
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
      <NativeTabs.Trigger name="pulse">
        <NativeTabs.Trigger.Label>This week</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_today" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
