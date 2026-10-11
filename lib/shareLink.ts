import { Platform, Share } from 'react-native';

/**
 * Hands a link on: the system share sheet on phones (and on web where the
 * browser has one, unless `copy` asks for the clipboard), else the clipboard.
 * Says which happened so the button can read "Copied". Throws when the
 * browser refuses both, so the caller can show the link to copy by hand.
 *
 * ponytail: no expo-clipboard, so native always shares; the share sheet has
 * Copy. Add expo-clipboard if a native "Copy" button is ever drawn.
 */
export async function shareLink(url: string, title: string, { copy = false }: { copy?: boolean } = {}): Promise<'shared' | 'copied'> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: url, url, title });
    return 'shared';
  }
  if (!copy && typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, title });
      return 'shared';
    } catch (e) {
      // Closing the sheet isn't a failure; anything else falls through to the clipboard.
      if (e instanceof Error && e.name === 'AbortError') return 'shared';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
