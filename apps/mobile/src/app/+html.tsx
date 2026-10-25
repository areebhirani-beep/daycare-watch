import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only page shell for the judges' link: a phone-width column centered on a neutral page, so a laptop
// shows the app as it looks on a phone.
const css = `
body { background: #EDEDF0; }
#root { max-width: 480px; margin: 0 auto; min-height: 100dvh; background: #FFFFFF; }
@media (prefers-color-scheme: dark) {
  body { background: #000000; }
  #root { background: #141416; }
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
