import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { isWeb } from '@/lib/runtime';
import { shareText } from '@/lib/share';
import { elevation, radius, space, useColors } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

type Letter = { subject: string; body: string };

/**
 * A ready-to-send request letter. Phones hand it to the share sheet. A desktop browser's share sheet shows no letter,
 * so a tap there looked like nothing happened: the web shows the letter itself, with Copy and Email.
 * Render `sheet` once on the screen and call `open` from any row.
 */
export function useLetter(): { open: (subject: string, body: string) => void; sheet: React.ReactNode } {
  const [letter, setLetter] = useState<Letter | null>(null);
  if (!isWeb) return { open: shareText, sheet: null };
  return {
    open: (subject, body) => setLetter({ subject, body }),
    sheet: <LetterSheet letter={letter} onClose={() => setLetter(null)} />,
  };
}

function LetterSheet({ letter, onClose }: { letter: Letter | null; onClose: () => void }) {
  const c = useColors();
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const close = () => {
    setCopied(null);
    onClose();
  };
  const copy = async () => {
    if (!letter) return;
    const text = `${letter.subject}\n\n${letter.body}`;
    // Copy inside the click first: in the framed page Chrome can leave navigator.clipboard waiting on a permission
    // that never shows, so it is the fallback, with a time limit, and a stuck copy says so.
    if (copyInClick(text)) return setCopied('yes');
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ]);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };
  const email = () => {
    if (!letter) return;
    void Linking.openURL(`mailto:?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`);
  };

  return (
    <Modal visible={letter !== null} transparent animationType="fade" onRequestClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close the letter" style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={close} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, elevation.sheet, { backgroundColor: c.surface }]} accessibilityViewIsModal>
          <Text variant="headline" accessibilityRole="header">
            {letter?.subject}
          </Text>
          <ScrollView style={[styles.letter, { backgroundColor: c.sunken }]} contentContainerStyle={{ padding: space.lg }}>
            <Text variant="callout" selectable>
              {letter?.body}
            </Text>
          </ScrollView>
          <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
            {copied === 'yes'
              ? 'Copied. Paste it into an email or a message to the director.'
              : copied === 'failed'
                ? 'This browser blocked copying. Select the letter and copy it.'
                : 'Fill in the parts in [brackets], then send it to the director.'}
          </Text>
          <View style={styles.buttons}>
            <Button label={copied === 'yes' ? 'Copied' : 'Copy letter'} kind="ink" icon="doc" onPress={() => void copy()} style={{ flex: 1 }} />
            <Button label="Email" kind="secondary" icon="external" onPress={email} style={{ flex: 1 }} />
          </View>
          <Button label="Close" kind="plain" size="md" onPress={close} />
        </View>
      </View>
    </Modal>
  );
}

function copyInClick(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
    maxHeight: '88%',
  },
  letter: { borderRadius: radius.md, flexShrink: 1 },
  buttons: { flexDirection: 'row', gap: space.sm },
});
