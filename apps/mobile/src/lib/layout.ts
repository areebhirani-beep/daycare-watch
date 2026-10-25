import { useWindowDimensions } from 'react-native';

import { isWeb } from './runtime';

/** Phone web is drawn in a column at most this wide (app/+html.tsx #root max-width under 768 px). */
export const WEB_COLUMN = 480;

/** At this browser width and up, web stops being a phone and becomes a panel over a map (DESIGN.md §11). */
export const SPLIT_MIN = 768;

/** The left panel's width in split mode: 360 on a tablet, 420 from a laptop up. */
export function panelWidthFor(width: number): number {
  return width >= 1024 ? 420 : 360;
}

export type Layout = {
  mode: 'phone' | 'split';
  /** The browser window (or the screen on a phone). */
  width: number;
  /** The left panel in split mode, 0 in phone mode. */
  panelWidth: number;
  /** The column screens draw in: the screen, the phone column, or the panel. */
  contentWidth: number;
};

/** One breakpoint hook for the whole app. Native is always 'phone'. */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  if (!isWeb) return { mode: 'phone', width, panelWidth: 0, contentWidth: width };
  if (width < SPLIT_MIN) return { mode: 'phone', width, panelWidth: 0, contentWidth: Math.min(width, WEB_COLUMN) };
  const panelWidth = panelWidthFor(width);
  return { mode: 'split', width, panelWidth, contentWidth: panelWidth };
}

/**
 * The width the app is actually drawn at. On a phone that's the screen; on the web it's the phone column or the
 * split panel, so a card sized from it fits that column instead of the desktop window.
 */
export function useAppWidth(): number {
  return useLayout().contentWidth;
}
