import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { maxScale, type TypeStyle, type as typeScale, useColors } from '@/theme';

export type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'onInk';

export type Props = TextProps & {
  variant?: TypeStyle;
  tone?: Tone;
  color?: string;
  /** Tabular figures. On by default for `numeral`, so columns of counts line up. */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

/** The only text primitive in the app. Every string goes through the type scale in tokens.ts. */
export function Text({ variant = 'body', tone = 'primary', color, tabular, align, style, ...rest }: Props) {
  const c = useColors();
  const toneColor = {
    primary: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    accent: c.accent,
    onAccent: c.onAccent,
    onInk: c.onInk,
  }[tone];
  const tab = tabular ?? variant === 'numeral';
  return (
    <RNText
      maxFontSizeMultiplier={maxScale[variant]}
      style={[
        typeScale[variant],
        { color: color ?? toneColor, textAlign: align },
        tab ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
