import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// No haptics on the web link.
const on = Platform.OS !== 'web';
const fire = (p: () => Promise<void>) => {
  if (on) void p().catch(() => undefined);
};

// Four feelings, used the same way everywhere. Failures are ignored: haptics are a bonus.
export const haptic = {
  /** Chips, tabs, strip columns. */
  select: () => fire(() => Haptics.selectionAsync()),
  /** 3D buttons and cards. */
  press: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Watch / unwatch, sheet snapping to full. */
  heavy: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Watching started, alerts on. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
