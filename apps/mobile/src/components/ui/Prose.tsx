// Reading blocks: `Heading` is the heavy grotesk title, `SectionHead` a bold section title,
// `InspectorQuote` the inspector's words in a quiet card.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { haptic, radius, space, useColors } from '@/theme';

import { Text, type Props as TextProps } from './Text';

type SerifStyle = 'display' | 'title' | 'heading' | 'quote';
const MAP = { display: 'display', title: 'largeTitle', heading: 'title', quote: 'body' } as const;

type Props = Omit<TextProps, 'variant' | 'tone'> & { variant?: SerifStyle; tone?: 'primary' | 'secondary' };

/** Prefer `Text` with `display`, `largeTitle` or `title`. */
export function Heading({ variant = 'title', ...rest }: Props) {
  return <Text variant={MAP[variant]} {...rest} />;
}

/** A section opens with a bold title and an optional right-aligned fact. No rules, no caps. */
export function SectionHead({ title, aside, first }: { title: string; aside?: string; first?: boolean }) {
  return (
    <View style={[styles.head, first && { marginTop: space.xxl }]}>
      <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {aside ? (
        <Text variant="footnote" tone="secondary" tabular>
          {aside}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The inspector's words in a quiet card. Three lines show; tapping opens the rest in place.
 * `source` is the rule reference, shown under the quote when open.
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
  text = text.replace(/([A-Za-z])\?(s|t|re|ll|ve|d)\b/g, '$1’$2');
  const same = plain ? squash(text) === squash(plain) : false;
  const repeats = plain ? !same && squash(text).startsWith(squash(plain)) : false;

  if (same) {
    return (
      <Text variant="footnote" tone="tertiary">
        {source ? `The inspector’s words, word for word · ${source}` : 'The inspector’s words, word for word'}
      </Text>
    );
  }
  if (repeats && !open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={`${label} in full`}
        onPress={() => {
          haptic.select();
          setOpen(true);
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
      >
        <Text variant="subhead" tone="accent">{`${label} in full`}</Text>
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
        haptic.select();
        setOpen((o) => !o);
      }}
      style={({ pressed }) => [styles.quote, { backgroundColor: c.sunken }, pressed && { opacity: 0.8 }]}
    >
      <Text variant="caption" tone="tertiary">
        {label.toUpperCase()}
      </Text>
      <Text
        variant="callout"
        tone="secondary"
        numberOfLines={open ? undefined : 3}
        onTextLayout={(e) => {
          if (!open && e.nativeEvent.lines.length >= 3) setLong(true);
        }}
      >
        {`“${text}”`}
      </Text>
      {open ? (
        <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={{ gap: space.xs }}>
          {source ? (
            <Text variant="footnote" tone="tertiary">
              {source}
            </Text>
          ) : null}
          {note ? (
            <Text variant="footnote" tone="tertiary">
              {note}
            </Text>
          ) : null}
        </Animated.View>
      ) : long || source ? (
        <Text variant="subhead" tone="accent">
          Show more
        </Text>
      ) : null}
    </Pressable>
  );
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  head: {
    marginTop: space.xxxl,
    marginBottom: space.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
  },
  quote: { borderRadius: radius.lg, padding: space.lg, gap: space.sm, minHeight: 44 },
});
