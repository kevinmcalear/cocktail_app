import { shareOrCopy } from '@/lib/shareLink';

/**
 * Share a profile's link: the share sheet, or "Link copied" on the web. When
 * the browser refuses the clipboard too, it shows the link to copy by hand
 * (Eddie, build 51: before, nothing happened at all).
 */
export function useShareLink(url: string, title: string) {
  return () => shareOrCopy(url, title);
}
