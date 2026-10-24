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
    High: '#A3321F',
    'Medium High': '#9C4F12',
    Medium: '#76600F',
    'Medium Low': '#4F5D66',
    Low: '#625F58',
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
    High: '#F2907C',
    'Medium High': '#E8A566',
    Medium: '#D6C06A',
    'Medium Low': '#A9B6BE',
    Low: '#A8A59D',
  },
};

export type Colors = Palette;

export const font = {
  regular: 'PublicSans_400Regular',
  medium: 'PublicSans_500Medium',
  semibold: 'PublicSans_600SemiBold',
  bold: 'PublicSans_700Bold',
} as const;

// Strict scale. Nothing outside these eight styles appears in the app.
export const type = {
  largeTitle: { fontFamily: font.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
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

export const motion = { fast: 150, base: 220 } as const;

export const minTap = 44;

// Ordinal position of each state risk level, used by the five-mark glyph.
export const riskRank: Record<RiskLevel, 1 | 2 | 3 | 4 | 5> = {
  High: 5,
  'Medium High': 4,
  Medium: 3,
  'Medium Low': 2,
  Low: 1,
};
