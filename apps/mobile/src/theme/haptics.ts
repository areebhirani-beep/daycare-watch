import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS !== 'web';

// Four feelings, used the same way everywhere. Failures are ignored: haptics are a bonus.
export const haptic = {
  /** Chips, tabs, strip columns. */
  select: () => void (on && Haptics.selectionAsync().catch(() => undefined)).catch(() => undefined),
  /** 3D buttons and cards. */
  press: () => void (on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)).catch(() => undefined),
  /** Watch / unwatch, sheet snapping to full. */
  heavy: () => void (on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)).catch(() => undefined),
  /** Watching started, alerts on. */
  success: () => void (on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)).catch(() => undefined),
};
