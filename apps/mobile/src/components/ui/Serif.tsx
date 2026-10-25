import { isLoaded } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, type TextProps, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { T } from '@/components/T';
import { font, type SerifStyle, serifType, space, useColors } from '@/theme';

const MAX_SCALE: Record<SerifStyle, number> = { display: 1.4, title: 1.5, heading: 1.7, quote: 2 };

// Public Sans stands in until the Newsreader files are loaded, so nothing ever renders in a system face.
const FALLBACK: Record<SerifStyle, string> = {
  display: font.bold,
  title: font.bold,
  heading: font.semibold,
  quote: font.regular,
};

type Props = TextProps & { variant?: SerifStyle; tone?: 'primary' | 'secondary'; color?: string };

/** The record's second voice: names, titles, and the state's own words. */
export function Serif({ variant = 'title', tone = 'primary', color, style, ...rest }: Props) {
  const c = useColors();
  const spec = serifType[variant];
  const family = isLoaded(spec.fontFamily) ? spec.fontFamily : FALLBACK[variant];
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      style={[spec, { fontFamily: family, color: color ?? (tone === 'primary' ? c.text : c.textSecondary) }, style]}
      {...rest}
    />
  );
}

/**
 * A section opens like a printed report: a full-width ink rule, then a sentence-case serif heading.
 * Replaces the uppercase tracked label everywhere. `aside` is an optional right-aligned fact.
 */
export function SectionHead({ title, aside, first }: { title: string; aside?: string; first?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.head, first && { marginTop: space.xxl }]}>
      <View style={[styles.rule, { backgroundColor: c.text }]} />
      <View style={styles.headRow}>
        <Serif variant="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Serif>
        {aside ? (
          <T variant="footnote" tone="secondary" tabular>
            {aside}
          </T>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The inspector's words, quoted inline in serif italic. Two lines show; tapping opens the rest in place.
 * `source` is the rule reference, set in the data face under the quote.
 */
export function InspectorQuote({
  text,
  source,
  note,
  label = 'Inspector’s words',
  plain,
}: {
  text: string;
  source?: string | null;
  note?: string | null;
  /** What the quote is, for the link and screen readers. The law's text uses "The law's words". */
  label?: string;
  /** Our plain summary shown above. When the state's words repeat it, the quote stays folded. */
  plain?: string | null;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  // The state's export drops apostrophes as "?" ("child?s"). Restore them for display only.
  text = text.replace(/([A-Za-z])\?(s|t|re|ll|ve|d)\b/g, '$1\u2019$2');
  const same = plain ? squash(text) === squash(plain) : false;
  const repeats = plain ? !same && squash(text).startsWith(squash(plain)) : false;

  // Word for word the same: say so, and give the rule. Nothing to expand.
  if (same) {
    return (
      <T variant="footnote" tone="secondary">
        {source ? `The inspector’s words, word for word · ${source}` : 'The inspector’s words, word for word'}
      </T>
    );
  }
  // The summary is the first sentence of the quote: fold it to a link so it doesn't repeat.
  if (repeats && !open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={`${label} in full`}
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen(true);
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
      >
        <T variant="footnote" tone="accent">{`${label} in full`}</T>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}: ${text}`}
      accessibilityHint={open ? 'Shows less' : 'Shows the full text and the rule'}
      onPress={() => {
        void Haptics.selectionAsync();
        setOpen((o) => !o);
      }}
      style={({ pressed }) => [styles.quote, { borderLeftColor: c.border }, pressed && { opacity: 0.7 }]}
    >
      <Serif
        variant="quote"
        tone="secondary"
        numberOfLines={open ? undefined : 2}
        onTextLayout={(e) => {
          if (!open && e.nativeEvent.lines.length >= 2) setLong(true);
        }}
      >
        {`“${text}”`}
      </Serif>
      {open ? (
        <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={{ gap: space.xs }}>
          {source ? (
            <T variant="footnote" tone="secondary">
              {source}
            </T>
          ) : null}
          {note ? (
            <T variant="footnote" tone="secondary">
              {note}
            </T>
          ) : null}
        </Animated.View>
      ) : long || source ? (
        <T variant="footnote" tone="accent">
          {`${label} in full`}
        </T>
      ) : null}
    </Pressable>
  );
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  head: { marginTop: space.section, gap: space.md },
  rule: { height: 1.5 },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  quote: { borderLeftWidth: 2, paddingLeft: space.md, paddingVertical: space.xxs, gap: space.xs, minHeight: 44 },
});
