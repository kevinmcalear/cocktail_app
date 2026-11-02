// A draft's photo, read on the phone for the sketch colour's From your photo
// row (add wizard, E27): the photo only reaches the server once the drink is
// saved, so the colours image-palette works out there come too late. Read
// into pixels by lib/photoPixels (a canvas on the web).

import { photoColours } from '@/supabase/functions/_shared/palette';

import { readPhotoPixels } from './photoPixels';

/** Enough rows to find the colours, few enough to read at once. */
export const COLOUR_ROWS = 120;

/** Up to five colours from the photo at `uri`, the drink's first; none when this build can't shrink a photo. */
export async function readPhotoColours(uri: string): Promise<string[]> {
  const pixels = await readPhotoPixels(uri, COLOUR_ROWS);
  return pixels ? photoColours(pixels.data, pixels.width) : [];
}
