import { shareLink } from '@/lib/shareLink';
import { toastDone } from '@/lib/toast';

/** Share a profile's link: the share sheet, or "Link copied" on the web. */
export function useShareLink(url: string, title: string) {
  return async () => {
    try {
      if ((await shareLink(url, title)) === 'copied') toastDone('Link copied');
    } catch {
      // Cancelled, or the browser refused the clipboard: nothing to undo.
    }
  };
}
