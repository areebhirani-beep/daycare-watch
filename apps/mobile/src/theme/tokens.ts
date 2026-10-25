// Design tokens v2. See apps/mobile/DESIGN.md for the reasoning behind each value.
// Native grotesk set heavy, white and neutral greys, true black dark mode, ink for every action,
// school-bus yellow only for watching and alerts, and a single-hue ember ramp for the record.

import { Platform, type TextStyle } from 'react-native';

export type RiskLevel = 'High' | 'Medium High' | 'Medium' | 'Medium Low' | 'Low';

type Palette = {
  bg: string;
  surface: string;
  sunken: string;
  border: string;
  hairline: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Text, strokes and small marks that must clear contrast: ink in light, yellow in dark. */
  accent: string;
  onAccent: string;
  accentEdge: string;
  /** Highlighter wash behind a selected or watched row. */
  accentSoft: string;
  /** School-bus yellow. Fills only (watched pins, the alerts button, the celebration), always with ink on top. */
  signal: string;
  onSignal: string;
  signalEdge: string;
  ink: string;
  onInk: string;
  inkEdge: string;
  secondaryEdge: string;
  scrim: string;
  skeleton: string;
  mapPin: string;
  mapPinWatched: string;
  risk: Record<RiskLevel, string>;
};

export const light: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  sunken: '#F2F2F4',
  border: '#DCDCE1',
  hairline: '#E8E8EC',
  text: '#0B0B0C',
  textSecondary: '#5C5C66',
  textTertiary: '#6E6E78',
  accent: '#0B0B0C',
  onAccent: '#FFFFFF',
  accentEdge: '#3A3A40',
  accentSoft: '#FFF6C9',
  signal: '#FFC800',
  onSignal: '#0B0B0C',
  signalEdge: '#D19E00',
  ink: '#0B0B0C',
  onInk: '#FFFFFF',
  inkEdge: '#3A3A40',
  secondaryEdge: '#D4D4DA',
  scrim: 'rgba(0,0,0,0.32)',
  skeleton: '#ECECEF',
  mapPin: '#0B0B0C',
  mapPinWatched: '#FFC800',
  risk: {
    // One hue, light to deep: an ordinal scale, not a traffic light. Every step clears 3:1 on white.
    High: '#7E1A0D',
    'Medium High': '#A2361A',
    Medium: '#BF5A2A',
    'Medium Low': '#AA7658',
    Low: '#8C837D',
  },
};

export const dark: Palette = {
  bg: '#000000',
  surface: '#141416',
  sunken: '#1F1F22',
  border: '#38383E',
  hairline: '#26262A',
  text: '#F5F5F7',
  textSecondary: '#A8A8B2',
  textTertiary: '#8C8C96',
  accent: '#FFD21F',
  onAccent: '#000000',
  accentEdge: '#B88F00',
  accentSoft: '#2A2300',
  signal: '#FFD21F',
  onSignal: '#000000',
  signalEdge: '#A88200',
  ink: '#F5F5F7',
  onInk: '#000000',
  inkEdge: '#A8A8B2',
  secondaryEdge: '#0A0A0B',
  scrim: 'rgba(0,0,0,0.56)',
  skeleton: '#1F1F22',
  mapPin: '#F5F5F7',
  mapPinWatched: '#FFD21F',
  risk: {
    // On black the ramp runs dim to bright, so High is the most luminous step. All clear 3.7:1 on sunken.
    High: '#FF9C80',
    'Medium High': '#E8866A',
    Medium: '#C97A5C',
    'Medium Low': '#A3857A',
    Low: '#7F7874',
  },
};

export type Colors = Palette;

// The platform grotesk: SF Pro on iOS (Text/Display switch optically at 20 pt), Roboto on Android.
const family = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

type Weight = NonNullable<TextStyle['fontWeight']>;
const face = (fontWeight: Weight) => ({ fontFamily: family, fontWeight }) as const;

/** For the few places that set a family directly (inputs, nav headers). Prefer `type.*`. */
export const font = {
  regular: family,
  medium: family,
  semibold: family,
  bold: family,
} as const;

export const weight = { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' } as const;

// Strict scale. Nothing outside these styles appears in the app.
export const type = {
  /** One per screen at most: the place page's hero fact. */
  hero: { ...face('800'), fontSize: 104, lineHeight: 104, letterSpacing: -4 },
  numeral: { ...face('800'), fontSize: 56, lineHeight: 60, letterSpacing: -1.5 },
  display: { ...face('800'), fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  largeTitle: { ...face('800'), fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  title: { ...face('700'), fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  headline: { ...face('700'), fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { ...face('400'), fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  callout: { ...face('500'), fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  subhead: { ...face('600'), fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  footnote: { ...face('500'), fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { ...face('600'), fontSize: 12, lineHeight: 16, letterSpacing: 0 },
} as const;

export type TypeStyle = keyof typeof type;

/** How far each style may grow with Dynamic Type before it would break its layout. */
export const maxScale: Record<TypeStyle, number> = {
  hero: 1.1,
  numeral: 1.3,
  display: 1.4,
  largeTitle: 1.5,
  title: 1.7,
  headline: 2,
  body: 2.2,
  callout: 2,
  subhead: 2,
  footnote: 2,
  caption: 1.8,
};

/** Mid-size counts (list rows, alert detail). The hero counts use `type.numeral`. */
export const figure = { ...face('800'), fontSize: 28, lineHeight: 32, letterSpacing: -0.6 } as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

export const radius = { sm: 8, thumb: 12, md: 12, button: 16, lg: 16, card: 16, stat: 22, sheet: 28, pill: 999 } as const;

// Only things that float over the map cast a shadow. Everything else is flat.
export const elevation = {
  card: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  float: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  sheet: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
} as const;

// Durations in ms. Entrances ease out; nothing loops; Reduce Motion turns all of it off.
export const motion = { fast: 150, base: 220, slow: 360, stagger: 30 } as const;

// Reanimated spring configs (withSpring). Sheet detents, 3D presses, celebratory pops.
export const spring = {
  sheet: { damping: 24, stiffness: 260, mass: 1 },
  press: { damping: 18, stiffness: 500, mass: 0.6 },
  pop: { damping: 12, stiffness: 220, mass: 0.8 },
} as const;

// Bottom sheet detents for the map home (Apple Maps). Peek is in points above the bottom inset.
export const sheet = { peek: 156, half: '64%', grabber: { width: 36, height: 5, top: 6 } } as const;

// 3D button edge depth (Duolingo).
export const buttonEdge = 4;

export const minTap = 44;

// Room for the floating native tab bar so the last row is never covered.
export const TAB_BAR_CLEARANCE = 112;

// Ordinal position of each state risk level, used by the record strip.
export const riskRank: Record<RiskLevel, 1 | 2 | 3 | 4 | 5> = {
  High: 5,
  'Medium High': 4,
  Medium: 3,
  'Medium Low': 2,
  Low: 1,
};
