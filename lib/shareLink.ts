import { Platform, Share } from 'react-native';

/**
 * Shares a link: the share sheet on a phone (and in browsers that have one),
 * otherwise copies it. Says which, so the caller can say "Link copied".
 * Throws when the person cancels or the browser refuses the clipboard.
 */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied'> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: url, url, title });
    return 'shared';
  }
  if (typeof navigator.share === 'function') {
    await navigator.share({ url, title });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
