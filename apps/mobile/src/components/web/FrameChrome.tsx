import type { PropsWithChildren } from 'react';

/** Native: the real phone draws its own status bar and home indicator. See FrameChrome.web.tsx. */
export function FrameChrome() {
  return null;
}

/** Native: the real phone reports its own safe areas. */
export function FrameInsets({ children }: PropsWithChildren) {
  return children;
}
