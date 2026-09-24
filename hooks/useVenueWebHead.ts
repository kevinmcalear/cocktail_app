import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { VenueBranding } from '@/hooks/useVenueBranding';
import { venueIconUrl, venueManifestUrl } from '@/lib/venueLink';

/**
 * On web, point the page's install metadata (set in app/+html.tsx) at the
 * venue, so Add to Home Screen and Chrome's install use the venue's name and
 * icon. The network app's metadata comes back when the page closes.
 */
export function useVenueWebHead(venue: VenueBranding | null | undefined) {
  const slug = venue?.slug;
  const name = venue?.name;

  useEffect(() => {
    if (Platform.OS !== 'web' || !slug || !name) return;
    const restore = [
      setAttribute('link[rel="manifest"]', 'href', venueManifestUrl(slug)),
      setAttribute('link[rel="apple-touch-icon"]', 'href', venueIconUrl(slug, 180)),
      setAttribute('meta[name="apple-mobile-web-app-title"]', 'content', name),
    ];
    return () => restore.forEach((undo) => undo());
  }, [slug, name]);
}

/** Set an attribute on an existing head element; returns a function that undoes it. */
function setAttribute(selector: string, attribute: string, value: string): () => void {
  const element = document.head.querySelector(selector);
  if (!element) return () => {};
  const previous = element.getAttribute(attribute);
  element.setAttribute(attribute, value);
  return () => {
    if (previous === null) element.removeAttribute(attribute);
    else element.setAttribute(attribute, previous);
  };
}
