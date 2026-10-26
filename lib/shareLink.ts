import * as Burnt from 'burnt';
import { Platform, Share, type ShareContent } from 'react-native';

import { showMessage } from '@/lib/dialogs';
import { siteOrigin } from '@/lib/venueLink';

/**
 * A drink's public link, by its slug (/d/penicillin, useShareSlug) or its id:
 * its page for anyone it's published to, or a sign-in for the rest.
 */
export function drinkUrl(slugOrId: string): string {
  return `${siteOrigin()}/d/${slugOrId}`;
}

/**
 * What the native share sheet gets for a link. iOS sends `message` and `url`
 * as two items, so a link in both arrives twice (Q31): iOS gets only the
 * `url`, plus any lead-in as the message. Android ignores `url`, so the link
 * goes in the message text, after the lead-in.
 */
export function linkShareContent(os: typeof Platform.OS, url: string, title: string, lead?: string): ShareContent {
  if (os === 'ios') return lead ? { url, title, message: lead } : { url, title };
  return { message: lead ? `${lead}: ${url}` : url, title };
}

/**
 * Hands a link on: the system share sheet on phones (and on web where the
 * browser has one, unless `copy` asks for the clipboard), else the clipboard.
 * Says which happened so the button can read "Copied". Throws when the
 * browser refuses both, so the caller can show the link to copy by hand.
 * `lead` is text that goes before the link ("What goes with gin").
 *
 * ponytail: no expo-clipboard, so native always shares; the share sheet has
 * Copy. Add expo-clipboard if a native "Copy" button is ever drawn.
 */
export async function shareLink(url: string, title: string, { copy = false, lead }: { copy?: boolean; lead?: string } = {}): Promise<'shared' | 'copied'> {
  if (Platform.OS !== 'web') {
    await Share.share(linkShareContent(Platform.OS, url, title, lead));
    return 'shared';
  }
  if (!copy && typeof navigator.share === 'function') {
    try {
      await navigator.share(lead ? { url, title, text: lead } : { url, title });
      return 'shared';
    } catch (e) {
      // Closing the sheet isn't a failure; anything else falls through to the clipboard.
      if (e instanceof Error && e.name === 'AbortError') return 'shared';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

/**
 * Share a link the plain way: the share sheet, or the clipboard with a toast.
 * Shows the link to copy by hand when even that is refused.
 */
export async function shareOrCopy(url: string, title: string, lead?: string): Promise<void> {
  try {
    if ((await shareLink(url, title, { lead })) === 'copied') Burnt.toast({ title: 'Link copied', preset: 'done', duration: 2 });
  } catch {
    showMessage("Couldn't share the link", url);
  }
}

/** Share some text (a batch to make): the share sheet, or the clipboard on the web. */
export async function shareText(text: string, title: string): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await Share.share({ message: text, title });
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ text, title });
      return;
    }
    await navigator.clipboard.writeText(text);
    Burnt.toast({ title: 'Copied', preset: 'done', duration: 2 });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    showMessage("Couldn't share it", text);
  }
}
