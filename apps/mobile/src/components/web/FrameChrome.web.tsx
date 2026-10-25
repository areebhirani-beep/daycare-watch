import { usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { FRAME_SCREEN, inFrame } from '@/lib/layout';
import { useIsDark } from '@/theme';

// A phone shows no scrollbars; a desktop browser would draw them inside the drawn screen. expo-router's web tab bar
// is pinned to the top of the window, under the drawn status bar; on the iPhone the tabs sit at the bottom, so inside
// the frame they move there, above the home indicator.
if (inFrame) {
  const style = document.createElement('style');
  style.textContent = [
    '* { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }',
    '[class*="navigationMenuRoot"] { top: auto !important; bottom: 42px !important; padding: 4px; border-radius: 999px;' +
      ' background: #FFFFFF !important; box-shadow: 0 0 0 1px #E8E8EC; }',
    '@media (prefers-color-scheme: dark) { [class*="navigationMenuRoot"] { background: #1C1C1E !important;' +
      ' box-shadow: 0 0 0 1px #26262A; } }',
  ].join('\n');
  document.head.appendChild(style);
}

// An iPhone 17 Pro's safe areas: under the status bar and above the home indicator. The tab screens also keep their
// last rows clear of the tab bar.
const FRAME_INSETS = { top: 59, bottom: 34, left: 0, right: 0 };
const TAB_INSETS = { ...FRAME_INSETS, bottom: 90 };
const TAB_ROUTE = /^\/(watching|rights|pulse)?\/?$/;

/**
 * Inside the frame, screens get the drawn iPhone's safe areas. On the web expo-router provides zero insets
 * (expo-router/build/SafeAreaProvider.js), so this sets them for everything below it.
 */
export function FrameInsets({ children }: PropsWithChildren) {
  const path = usePathname();
  if (!inFrame) return children;
  const insets = TAB_ROUTE.test(path) ? TAB_INSETS : FRAME_INSETS;
  return <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>;
}

const INK = '#0B0B0C';
const WHITE = '#FFFFFF';
// Screens whose top is a picture (the place hero, onboarding's first step) take a white status bar, as on iOS.
const OVER_PICTURE = /^\/(daycare\/[^/]+|onboarding)\/?$/;

/** The status bar (9:41, signal, Wi-Fi, battery) and home indicator of the drawn iPhone. Decoration only. */
export function FrameChrome() {
  const path = usePathname();
  const isDark = useIsDark();
  if (!inFrame) return null;
  const fg = isDark || OVER_PICTURE.test(path) ? WHITE : INK;
  const ear = (FRAME_SCREEN.width - 126) / 2;
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483000 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 59, display: 'flex', color: fg }}>
        <div style={{ width: ear, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
          <span style={{ font: '600 17px/22px -apple-system, BlinkMacSystemFont, system-ui, sans-serif', letterSpacing: -0.4 }}>
            9:41
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ width: ear, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 2 }}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill={fg}>
            <rect x="0" y="8" width="3" height="4" rx="1" />
            <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
            <rect x="10" y="3" width="3" height="9" rx="1" />
            <rect x="15" y="0" width="3" height="12" rx="1" />
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill={fg}>
            <path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.2-1.2A10.2 10.2 0 0 0 8 .6C5.2.6 2.7 1.7.8 3.5L2 4.7a8.5 8.5 0 0 1 6-2.4Z" />
            <path d="M8 5.7c1.4 0 2.6.5 3.6 1.4l1.2-1.2A6.9 6.9 0 0 0 8 4c-1.9 0-3.6.7-4.8 1.9l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Z" />
            <path d="M8 9.1c.5 0 .9.2 1.2.5L8 11.4 6.8 9.6c.3-.3.7-.5 1.2-.5Z" />
          </svg>
          <svg width="27" height="13" viewBox="0 0 27 13">
            <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke={fg} strokeOpacity="0.4" />
            <rect x="2" y="2" width="20" height="9" rx="2.5" fill={fg} />
            <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill={fg} fillOpacity="0.4" />
          </svg>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          width: 134,
          height: 5,
          marginLeft: -67,
          borderRadius: 3,
          background: isDark ? WHITE : INK,
        }}
      />
    </div>
  );
}
