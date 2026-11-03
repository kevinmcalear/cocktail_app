import { Platform } from 'react-native';

import { optionalNative } from '@/lib/optionalNative';

type ClipboardModule = typeof import('expo-clipboard');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the native module exists
const clipboard = optionalNative<ClipboardModule>('ExpoClipboard', () => require('expo-clipboard'));

/** A marker for "something is copied, read it when they tap" (iOS asks before every read, Android 12+ shows a "pasted" toast). */
export const UNREAD_CLIP = '\u0000unread';

/**
 * What's on the clipboard, for Add's and Bring in's offer, without a prompt
 * or a toast: on phones only whether there's text. Reading it asks "Allow
 * Paste?" on iOS and shows "pasted from your clipboard" on Android 12+, so
 * the offer says something is copied and reads it on the tap. hasStringAsync
 * checks the clip's description (its type), never its text, so neither fires.
 */
export async function peekClipboard(): Promise<string | null> {
  if (!clipboard) return null;
  try {
    return (await clipboard.hasStringAsync()) ? UNREAD_CLIP : null;
  } catch {
    return null;
  }
}

/**
 * What's copied, read now: its text, or a picture (a screenshot of a menu)
 * when there's no text, or null. Text first, so a card that offered the copied
 * link reads that link. One read on the web, where the browser asks first.
 */
export async function readClipboardAny(): Promise<{ text: string } | { image: { uri: string; mimeType: string } } | null> {
  try {
    if (Platform.OS === 'web') {
      const items = (await navigator.clipboard?.read?.()) ?? [];
      for (const item of items) {
        if (item.types.includes('text/plain')) {
          const text = (await (await item.getType('text/plain')).text()).trim();
          if (text) return { text };
        }
        const kind = item.types.find((t) => t.startsWith('image/'));
        if (kind) return { image: { uri: URL.createObjectURL(await item.getType(kind)), mimeType: kind } };
      }
      // read() is missing in some browsers and refuses some clips: try plain text.
      const plain = await navigator.clipboard?.readText?.();
      return plain?.trim() ? { text: plain.trim() } : null;
    }
    const text = await readClipboard();
    if (text) return { text };
    if (!clipboard || !(await clipboard.hasImageAsync())) return null;
    const image = await clipboard.getImageAsync({ format: 'jpeg', jpegQuality: 0.7 });
    return image ? { image: { uri: image.data, mimeType: 'image/jpeg' } } : null;
  } catch {
    if (Platform.OS !== 'web') return null;
    try {
      const plain = (await navigator.clipboard?.readText?.())?.trim();
      return plain ? { text: plain } : null;
    } catch {
      return null;
    }
  }
}

/** The clipboard's text, read now, only on a tap (iOS asks first, Android shows its toast). */
export async function readClipboard(): Promise<string | null> {
  if (!clipboard) return null;
  try {
    return (await clipboard.getStringAsync()).trim() || null;
  } catch {
    return null;
  }
}

/** Puts text on the clipboard. False when it can't: a build without the clipboard module (an older binary on an update). */
export async function writeClipboard(text: string): Promise<boolean> {
  if (!clipboard) return false;
  try {
    return await clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
