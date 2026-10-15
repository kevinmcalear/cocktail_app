import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { logoEdge, logoEdgeFromUrl, type LogoEdge } from '@/supabase/functions/_shared/logoEdge';

export type { LogoEdge };

/**
 * What the app knows about a logo's edge: the edge, null when it can't tell
 * (draw the logo as it is), or undefined while the web is still looking.
 */
export type KnownEdge = LogoEdge | null | undefined;

const SAMPLE = 48;
const sampled = new Map<string, LogoEdge | null>();
const looking = new Map<string, Promise<LogoEdge | null>>();

/**
 * Logos uploaded since upload-bar-logo started naming them carry their edge in
 * their name; older ones carry it as their URL's fragment once
 * supabase/functions/_scripts/backfill-logo-edges.ts has run. A logo with
 * neither (set since, or from another host): the web reads the pixels (once a
 * session per logo); native can't, so it draws it as it is.
 */
export function knownLogoEdge(url: string): KnownEdge {
  const named = logoEdgeFromUrl(url);
  if (named) return named;
  if (Platform.OS !== 'web') return null;
  return sampled.get(url);
}

/** Reads an older logo's edge on the web, from a small copy drawn on a canvas. Null if it can't (no CORS, not an image). */
export function lookAtLogoEdge(url: string): Promise<LogoEdge | null> {
  const known = knownLogoEdge(url);
  if (known !== undefined) return Promise.resolve(known);
  let pending = looking.get(url);
  if (!pending) {
    pending = new Promise<LogoEdge | null>((resolve) => {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = SAMPLE;
          canvas.height = SAMPLE;
          const context = canvas.getContext('2d');
          if (!context) return resolve(null);
          context.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          resolve(logoEdge(context.getImageData(0, 0, SAMPLE, SAMPLE).data, SAMPLE, SAMPLE));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }).then((edge) => {
      sampled.set(url, edge);
      looking.delete(url);
      return edge;
    });
    looking.set(url, pending);
  }
  return pending;
}

/** A logo's edge for drawing it (see knownLogoEdge); on the web it looks at older logos and updates. */
export function useLogoEdge(url: string | null | undefined): KnownEdge {
  const [found, setFound] = useState<{ url: string; edge: LogoEdge | null } | null>(null);
  const known = url ? knownLogoEdge(url) : null;
  useEffect(() => {
    if (!url || known !== undefined) return;
    let live = true;
    void lookAtLogoEdge(url).then((edge) => live && setFound({ url, edge }));
    return () => {
      live = false;
    };
  }, [url, known]);
  return known !== undefined ? known : found && found.url === url ? found.edge : undefined;
}
