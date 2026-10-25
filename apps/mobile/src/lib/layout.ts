import { useWindowDimensions } from 'react-native';

import { isWeb } from './runtime';

/** Phone web is drawn in a column at most this wide (public/index.html #root max-width under 768 px). */
export const WEB_COLUMN = 480;

/** At this browser width and up, the web page shows the app inside an iPhone frame (DESIGN.md §11). */
export const FRAME_MIN = 768;

/** The frame's screen: an iPhone 17 Pro in points. The app runs at exactly this size inside the frame. */
export const FRAME_SCREEN = { width: 393, height: 852 } as const;

/** True inside the frame's iframe: the app is the one running on the drawn iPhone. */
export const inFrame = isWeb && typeof window !== 'undefined' && window.self !== window.top;

export type Layout = {
  /** 'framed': this window is the page around the iPhone frame and draws no app screens itself. */
  mode: 'phone' | 'framed';
  /** The browser window (or the screen on a phone). */
  width: number;
  /** The column screens draw in: the screen, the phone column, or the frame's screen. */
  contentWidth: number;
};

/** One breakpoint hook for the whole app. Native, and the app inside the frame, are always 'phone'. */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  if (!isWeb) return { mode: 'phone', width, contentWidth: width };
  if (!inFrame && width >= FRAME_MIN) return { mode: 'framed', width, contentWidth: FRAME_SCREEN.width };
  return { mode: 'phone', width, contentWidth: Math.min(width, WEB_COLUMN) };
}

/**
 * The width the app is actually drawn at. On a phone that's the screen; on the web it's the phone column, or the
 * frame's 393-point screen, so a card sized from it fits that column instead of the desktop window.
 */
export function useAppWidth(): number {
  return useLayout().contentWidth;
}
