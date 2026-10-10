import * as Burnt from 'burnt';
import { Platform, Share } from 'react-native';

import { showMessage } from '@/lib/dialogs';
import { siteOrigin } from '@/lib/venueLink';

/** A drink's public link: its page for anyone it's published to, or a sign-in for the rest. */
export function drinkUrl(itemId: string): string {
  return `${siteOrigin()}/d/${itemId}`;
}

/**
 * Share a link: the share sheet on phones and where the browser has one,
 * otherwise copied to the clipboard with a toast. Shows the link to copy by
 * hand when even that is refused.
 */
export async function shareLink(url: string, title: string): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await Share.share({ message: url, url, title });
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ url, title });
      return;
    }
    await navigator.clipboard.writeText(url);
    Burnt.toast({ title: 'Link copied', preset: 'done', duration: 2 });
  } catch (e) {
    // Closing the browser's share sheet rejects with AbortError: not a failure.
    if (e instanceof Error && e.name === 'AbortError') return;
    showMessage("Couldn't share the link", url);
  }
}
