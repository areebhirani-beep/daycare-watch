import { Linking, Share } from 'react-native';

import { isWeb } from './runtime';

/**
 * The share sheet on phones. On the web link, browsers without navigator.share (Firefox, Linux Chrome) or that
 * refuse it fall back to an email draft, so a tap is never silent. A parent cancelling the sheet is left alone.
 */
export function shareText(subject: string, body: string): void {
  const mail = () => void Linking.openURL(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  if (isWeb && typeof navigator.share !== 'function') return mail();
  Share.share({ title: subject, message: body }, { subject }).catch((e: unknown) => {
    if (isWeb && (e as { name?: string } | null)?.name !== 'AbortError') mail();
  });
}
