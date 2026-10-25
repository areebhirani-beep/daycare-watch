import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerDevice } from './api';
import { isWeb } from './runtime';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Asks the OS for permission (only after our own explainer), then registers the Expo push token.
 * Registration failures are reported, not thrown, so watching still succeeds.
 */
export type EnableResult = { permission: PermissionState; registered: boolean };

export async function enableAlerts(): Promise<EnableResult> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('state-records', {
      name: 'New state records',
      description: 'When Texas posts something new about a daycare you watch',
      importance: AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return { permission: status, registered: false };
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    if (!projectId || !Device.isDevice) return { permission: status, registered: false };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    return { permission: status, registered: true };
  } catch {
    return { permission: status, registered: false };
  }
}

type AlertData = { event_id?: number | string; operation_id?: number | string };

function openFromNotification(n: Notifications.Notification) {
  const data = n.request.content.data as AlertData | undefined;
  if (data?.event_id != null) {
    const params = data.operation_id != null ? `?operationId=${data.operation_id}` : '';
    router.push(`/alert/${data.event_id}${params}`);
  } else if (data?.operation_id != null) router.push(`/daycare/${data.operation_id}`);
}

/** Opens the alert detail when a parent taps a push, including a cold start from the push. */
export function useAlertTaps() {
  useEffect(() => {
    if (isWeb) return;
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openFromNotification(r.notification),
    );
    return () => sub.remove();
  }, []);
}
