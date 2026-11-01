import { Platform } from 'react-native';

import { optionalNative } from '@/lib/optionalNative';

type ClipboardModule = typeof import('expo-clipboard');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the native module exists
const clipboard = optionalNative<ClipboardModule>('ExpoClipboard', () => require('expo-clipboard'));

/** A marker for "something is copied, read it when they tap Use it" (iOS asks before every read). */
export const UNREAD_CLIP = '\u0000unread';

/**
 * What's on the clipboard, for Bring in's "On your clipboard" card, without
 * a prompt: on iOS only whether there's text (reading it asks "Allow
 * Paste?"), so the card says so and reads it on Use it; on Android the text.
 */
export async function peekClipboard(): Promise<string | null> {
  if (!clipboard) return null;
  try {
    if (!(await clipboard.hasStringAsync())) return null;
    if (Platform.OS === 'ios') return UNREAD_CLIP;
    const text = (await clipboard.getStringAsync()).trim();
    return text ? text.slice(0, 20_000) : null;
  } catch {
    return null;
  }
}

/**
 * A copied picture (a screenshot of a menu, a photo of a recipe), read now, or
 * null. On the web the browser asks first; asking whether there is one doesn't.
 */
export async function readClipboardImage(): Promise<{ uri: string; mimeType: string } | null> {
  try {
    if (Platform.OS === 'web') {
      const items = (await navigator.clipboard?.read?.()) ?? [];
      for (const item of items) {
        const kind = item.types.find((t) => t.startsWith('image/'));
        if (kind) return { uri: URL.createObjectURL(await item.getType(kind)), mimeType: kind };
      }
      return null;
    }
    if (!clipboard || !(await clipboard.hasImageAsync())) return null;
    const image = await clipboard.getImageAsync({ format: 'jpeg', jpegQuality: 0.7 });
    return image ? { uri: image.data, mimeType: 'image/jpeg' } : null;
  } catch {
    return null;
  }
}

/** The clipboard's text, read now (on iOS the system asks first). */
export async function readClipboard(): Promise<string | null> {
  if (!clipboard) return null;
  try {
    return (await clipboard.getStringAsync()).trim() || null;
  } catch {
    return null;
  }
}
