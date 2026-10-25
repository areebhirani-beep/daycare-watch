// Design tokens. See apps/mobile/DESIGN.md for the reasoning behind each choice.
// One family (Public Sans, the U.S. Web Design System typeface), one accent,
// warm paper neutrals, and a five-step risk ramp that is never the only signal.

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
  accent: string;
  onAccent: string;
  accentSoft: string;
  skeleton: string;
  mapPin: string;
  mapPinWatched: string;
  risk: Record<RiskLevel, string>;
};

export const light: Palette = {
  bg: '#F7F6F2',
  surface: '#FFFFFF',
  sunken: '#EEECE6',
  border: '#D9D5CB',
  hairline: '#E6E3DB',
  text: '#1B1A17',
  textSecondary: '#55524A',
  textTertiary: '#6E6A61',
  accent: '#1D5A54',
  onAccent: '#FFFFFF',
  accentSoft: '#E1ECEA',
  skeleton: '#E9E6DF',
  mapPin: '#1B1A17',
  mapPinWatched: '#1D5A54',
  risk: {
    // Warm and dark = a higher-risk rule; cool and gray = lower. High is the darkest step so it
    // separates under deuteranopia too. Every step clears 4.5:1 on paper, surface and sunken.
    High: '#8A1F12',
    'Medium High': '#A8460F',
    Medium: '#8A6400',
    'Medium Low': '#4D6472',
    Low: '#6B675E',
  },
};

export const dark: Palette = {
  bg: '#121210',
  surface: '#1C1B19',
  sunken: '#0B0B0A',
  border: '#3A3833',
  hairline: '#2A2925',
  text: '#EEECE6',
  textSecondary: '#B3AFA5',
  textTertiary: '#969288',
  accent: '#86CABF',
  onAccent: '#0C2421',
  accentSoft: '#1E3330',
  skeleton: '#26251F',
  mapPin: '#EEECE6',
  mapPinWatched: '#86CABF',
  risk: {
    // On dark, High is the most saturated step and Low the dimmest. All clear 5:1 on bg and surface.
    High: '#FF7B66',
    'Medium High': '#E89A58',
    Medium: '#CDB46A',
    'Medium Low': '#93A9B5',
    Low: '#928E86',
  },
};

export type Colors = Palette;

export const font = {
  regular: 'PublicSans_400Regular',
  medium: 'PublicSans_500Medium',
  semibold: 'PublicSans_600SemiBold',
  bold: 'PublicSans_700Bold',
} as const;

// Newsreader (Production Type) is the record's second voice: daycare names, screen and section
// titles, and the inspector's own words. Public Sans carries every number and every control.
export const serifFont = {
  regular: 'Newsreader_400Regular',
  italic: 'Newsreader_400Regular_Italic',
  medium: 'Newsreader_500Medium',
  semibold: 'Newsreader_600SemiBold',
} as const;

export const serifType = {
  display: { fontFamily: serifFont.semibold, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: serifFont.semibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: serifFont.medium, fontSize: 22, lineHeight: 27, letterSpacing: -0.2 },
  quote: { fontFamily: serifFont.italic, fontSize: 18, lineHeight: 25 },
} as const;

export type SerifStyle = keyof typeof serifType;

// Big counts on the record page, always tabular so columns of numbers line up.
export const figure = { fontFamily: font.semibold, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 } as const;

// Strict scale. Nothing outside these eight styles appears in the app.
export const type = {
  // Screen and section titles speak in the serif voice; everything below them stays in Public Sans.
  largeTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 33, lineHeight: 37, letterSpacing: -0.5 },
  title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  headline: { fontFamily: font.semibold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: font.regular, fontSize: 17, lineHeight: 25 },
  callout: { fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  subhead: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
} as const;

export type TypeStyle = keyof typeof type;

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

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

// Durations in ms. Entrances ease out; nothing loops; Reduce Motion turns all of it off.
export const motion = { fast: 150, base: 220, slow: 360, stagger: 18 } as const;

export const minTap = 44;

// Room for the floating native tab bar so the last row is never covered.
export const TAB_BAR_CLEARANCE = 112;

// Ordinal position of each state risk level, used by the five-mark glyph.
export const riskRank: Record<RiskLevel, 1 | 2 | 3 | 4 | 5> = {
  High: 5,
  'Medium High': 4,
  Medium: 3,
  'Medium Low': 2,
  Low: 1,
};
