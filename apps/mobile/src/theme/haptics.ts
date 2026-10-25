import * as Haptics from 'expo-haptics';

// Four feelings, used the same way everywhere. Failures are ignored: haptics are a bonus.
export const haptic = {
  /** Chips, tabs, strip columns. */
  select: () => void Haptics.selectionAsync().catch(() => undefined),
  /** 3D buttons and cards. */
  press: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  /** Watch / unwatch, sheet snapping to full. */
  heavy: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
  /** Watching started, alerts on. */
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
};
