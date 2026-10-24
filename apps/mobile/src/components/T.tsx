import { Text, type TextProps, type TextStyle } from 'react-native';

import { type TypeStyle, type as typeScale, useColors } from '@/theme';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent';

type Props = TextProps & {
  variant?: TypeStyle;
  tone?: Tone;
  color?: string;
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

const MAX_SCALE: Record<TypeStyle, number> = {
  largeTitle: 1.5,
  title: 1.7,
  headline: 2,
  body: 2.2,
  callout: 2.2,
  subhead: 2,
  footnote: 2,
  caption: 1.8,
};

/** The only text primitive in the app. Every string goes through the eight-style scale. */
export function T({ variant = 'body', tone = 'primary', color, tabular, align, style, ...rest }: Props) {
  const c = useColors();
  const toneColor = {
    primary: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    accent: c.accent,
    onAccent: c.onAccent,
  }[tone];
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      style={[
        typeScale[variant],
        { color: color ?? toneColor, textAlign: align },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
