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
        {/* The card a shared link shows; same tags as public/index.html. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Daycare Watch" />
        <meta property="og:title" content="Daycare Watch" />
        <meta
          property="og:description"
          content="What Texas inspectors found at your kid’s daycare, in plain English. Real state records from data.texas.gov, updated nightly."
        />
        <meta property="og:url" content="https://daycare-watch.vercel.app/" />
        <meta property="og:image" content="https://daycare-watch.vercel.app/og-1200x630.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Daycare Watch on an iPhone, showing a Frisco daycare's state record in plain words." />
        <meta name="twitter:card" content="summary_large_image" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
