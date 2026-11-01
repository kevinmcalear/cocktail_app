import { useQuery } from '@tanstack/react-query';

import { extractBrandColorsFromPixels } from '@/lib/extractBrandColors';
import { mergeLogoColours, pinsFromPixels, type LogoPin } from '@/lib/logoPins';
import { readLogoPixels } from '@/lib/logoPixels';

export interface LogoColours {
  /** The colours to offer from the logo, the known ones first, at most three. */
  colours: string[];
  /** Where each sits in the logo (lib/logoPins). */
  pins: LogoPin[];
  /** The logo's width over its height, to place the pins as LogoImage draws it. */
  aspect: number;
}

/**
 * A logo's colours and where each sits in it, read from its pixels on the
 * device (canvas Theme-flow-3: pins on the logo, up to three tiles). `known`
 * are the colours already found for it (a fresh upload's two, or the one
 * saved); the pixels add the rest by the upload's own rule
 * (extractBrandColorsFromPixels). Where the logo can't be read (a web host
 * with no CORS, an older build), it's the known colours and no pins.
 */
export function useLogoColours(logoUrl: string | null, known: string[]) {
  const fallback: LogoColours = { colours: known, pins: [], aspect: 1 };
  const query = useQuery({
    queryKey: ['logo-colours', logoUrl, known],
    enabled: !!logoUrl,
    staleTime: Infinity,
    // Read again each session: it's quick, and the cache needn't carry it.
    meta: { persist: false },
    queryFn: async (): Promise<LogoColours> => {
      const px = logoUrl ? await readLogoPixels(logoUrl).catch(() => null) : null;
      if (!px) return fallback;
      const found = extractBrandColorsFromPixels(px.data);
      const offered = mergeLogoColours(known, [found.primaryColor, found.secondaryColor]);
      const pins = pinsFromPixels(px.data, px.width, px.height, offered);
      // A colour read from the pixels stays only if it's there to pin (the rule's grey stand-in for a logo with no colour isn't).
      const colours = offered.filter((c) => known.some((k) => k.toUpperCase() === c) || pins.some((p) => p.hex === c));
      return { colours, pins, aspect: px.width / px.height };
    },
  });
  return logoUrl ? (query.data ?? fallback) : { ...fallback, colours: [] };
}
