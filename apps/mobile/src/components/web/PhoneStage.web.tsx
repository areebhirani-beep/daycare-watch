import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, useWindowDimensions } from 'react-native';

import { FRAME_SCREEN } from '@/lib/layout';
import { REPO_URL, VIDEO_URL } from '@/lib/links';
import { useColors, useIsDark } from '@/theme';

// The web page from 768 px up: the live app inside a drawn iPhone 17 Pro (DESIGN.md §11). The app runs in an iframe
// of this same URL at exactly 393×852, so every screen lays out as on the phone; the frame only scales it to fit.
const BEZEL = 12;
const RING = 4;
const RADIUS = 55;
const W = FRAME_SCREEN.width + 2 * (BEZEL + RING);
const H = FRAME_SCREEN.height + 2 * (BEZEL + RING);
const SIDE_MIN = 1024;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif';

// Titanium, flat and two-tone: an edge colour and a 1 px darker line inside it.
const METAL = { light: { edge: '#8E8A84', line: '#5E5B57' }, dark: { edge: '#3A3A3C', line: '#1C1C1E' } };

// Hardware buttons, measured from the top of the frame: [side, top, height].
const BUTTONS: ['left' | 'right', number, number][] = [
  ['left', 122, 34],
  ['left', 190, 64],
  ['left', 268, 64],
  ['right', 230, 104],
];

function here(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

/** The QR as one SVG path, ink on white, for the page's current URL. */
function QrCode({ url, size }: { url: string; size: number }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { d: path, n: count };
  }, [url]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={`QR code that opens ${url}`}>
      <path d={d} fill="#0B0B0C" />
    </svg>
  );
}

export function PhoneStage() {
  const c = useColors();
  const isDark = useIsDark();
  const { width, height } = useWindowDimensions();
  const frame = useRef<HTMLIFrameElement>(null);
  // The iframe opens the page that was asked for (a deep link lands on that daycare); it never reloads after.
  const [src] = useState(here);
  const [path, setPath] = useState(src);

  // Keep the address bar and the QR on the screen the parent is looking at, so a copied link or a scan opens it.
  useEffect(() => {
    const id = setInterval(() => {
      const loc = frame.current?.contentWindow?.location;
      if (!loc) return;
      const next = loc.pathname + loc.search + loc.hash;
      if (next === here()) return;
      window.history.replaceState(null, '', next);
      setPath(next);
    }, 300);
    return () => clearInterval(id);
  }, []);

  const s = Math.min(1, (height - 80) / H);
  const side = width >= SIDE_MIN;
  const metal = isDark ? METAL.dark : METAL.light;
  const url = `${window.location.origin}${path}`;

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 96,
        padding: '0 48px',
        background: c.bg,
        fontFamily: FONT,
        color: c.text,
        overflow: 'hidden',
      }}
    >
      {side ? (
        <section style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Image source={require('@/assets/images/icon.png')} style={{ width: 64, height: 64, borderRadius: 14 }} accessibilityLabel="" />
            <h1 style={{ margin: 0, font: `700 20px/25px ${FONT}` }}>Daycare Watch</h1>
          </div>
          <p style={{ margin: 0, font: `800 40px/44px ${FONT}`, letterSpacing: -0.8 }}>
            Know what Texas inspectors found before you pick a daycare.
          </p>
          <p style={{ margin: 0, font: `400 17px/24px ${FONT}`, color: c.textSecondary }}>
            Checked against data.texas.gov every day. Built for the 2026 Congressional App Challenge, TX-04.
          </p>
          <figure style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: '#FFFFFF', padding: 12, borderRadius: 16, lineHeight: 0 }}>
              <QrCode url={url} size={128} />
            </div>
            <figcaption style={{ font: `400 13px/18px ${FONT}`, color: c.textSecondary }}>Open on your phone</figcaption>
          </figure>
          {REPO_URL || VIDEO_URL ? (
            <nav aria-label="About this project" style={{ display: 'flex', gap: 24 }}>
              {REPO_URL ? (
                <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ font: `600 17px/22px ${FONT}`, color: c.text, padding: '11px 0' }}>
                  GitHub
                </a>
              ) : null}
              {VIDEO_URL ? (
                <a href={VIDEO_URL} target="_blank" rel="noreferrer" style={{ font: `600 17px/22px ${FONT}`, color: c.text, padding: '11px 0' }}>
                  Watch the video
                </a>
              ) : null}
            </nav>
          ) : null}
        </section>
      ) : (
        <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', margin: 0 }}>Daycare Watch</h1>
      )}

      {/* zoom, not transform: the browser lays the phone out at its scaled size, so the app's map tiles meet on whole
          pixels instead of showing hairline seams. */}
      <div style={{ position: 'relative', width: W, height: H, flexShrink: 0, zoom: s }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
          {BUTTONS.map(([at, top, h]) => (
            <div
              key={`${at}${top}`}
              aria-hidden="true"
              style={{ position: 'absolute', top, height: h, width: 3, [at]: -3, borderRadius: 1.5, background: metal.edge }}
            />
          ))}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: RADIUS + BEZEL + RING,
              background: metal.edge,
              boxShadow: `inset 0 0 0 1px ${metal.line}, 0 30px 80px rgba(0,0,0,0.18)`,
            }}
          />
          <div aria-hidden="true" style={{ position: 'absolute', inset: RING, borderRadius: RADIUS + BEZEL, background: '#000000' }} />
          <div
            style={{
              position: 'absolute',
              left: RING + BEZEL,
              top: RING + BEZEL,
              width: FRAME_SCREEN.width,
              height: FRAME_SCREEN.height,
              borderRadius: RADIUS,
              overflow: 'hidden',
              background: c.bg,
            }}
          >
            <iframe
              ref={frame}
              src={src}
              title="Daycare Watch app"
              width={FRAME_SCREEN.width}
              height={FRAME_SCREEN.height}
              style={{ border: 0, display: 'block' }}
            />
          </div>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: RING + BEZEL + 11,
              left: (W - 126) / 2,
              width: 126,
              height: 37,
              borderRadius: 18.5,
              background: '#000000',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </main>
  );
}
