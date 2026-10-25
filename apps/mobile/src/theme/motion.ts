import { Easing, ReduceMotion, withDelay, withTiming } from 'react-native-reanimated';

import { motion } from './tokens';

export const easeOut = Easing.out(Easing.cubic);
export const easeIn = Easing.in(Easing.cubic);

/**
 * The one entrance: fade + 8 pt rise, 200 ms ease-out. `index` staggers the first three items 30 ms
 * apart; later items arrive with the third. Use only on a list's first load, never on refresh.
 * With Reduce Motion the movement is skipped.
 */
export function enter(index = 0) {
  const delay = Math.min(index, motion.maxStagger - 1) * motion.stagger;
  return () => {
    'worklet';
    const cfg = { duration: motion.base, easing: easeOut, reduceMotion: ReduceMotion.System };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: motion.rise }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, cfg)),
        transform: [{ translateY: withDelay(delay, withTiming(0, cfg)) }],
      },
    };
  };
}

/** Plain cross-fade, for content swapping in place (onboarding beats, titles). */
export function fade(duration: number = motion.base) {
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0 },
      animations: { opacity: withTiming(1, { duration, easing: easeOut, reduceMotion: ReduceMotion.System }) },
    };
  };
}
