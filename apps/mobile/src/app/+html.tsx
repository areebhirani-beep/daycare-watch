import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only page shell for the judges' link. Under 768 px the app is a phone column; from 768 up the app draws an iPhone
// frame with the live app inside (DESIGN.md §11), so #root fills the window. Keep in step with public/index.html.
const css = `
body { background: #F2F2F5; }
#root { min-height: 100dvh; }
/* Keyboard focus: a 2 pt ring in the text colour, 2 pt outside (DESIGN.md §11). */
:focus-visible { outline: 2px solid #0B0B0C; outline-offset: 2px; }
@media (max-width: 767px) {
  #root { max-width: 480px; margin: 0 auto; background: #FFFFFF; }
}
@media (prefers-color-scheme: dark) {
  body { background: #000000; }
  #root { background: #000000; }
  :focus-visible { outline-color: #F5F5F7; }
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
