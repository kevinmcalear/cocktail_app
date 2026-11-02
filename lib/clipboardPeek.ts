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

/** The clipboard's text, read now, only on a tap (iOS asks first, Android shows its toast). */
export async function readClipboard(): Promise<string | null> {
  if (!clipboard) return null;
  try {
    return (await clipboard.getStringAsync()).trim() || null;
  } catch {
    return null;
  }
}
