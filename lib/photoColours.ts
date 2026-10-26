// A draft's photo, read on the phone for the sketch colour's From your photo
// row (add wizard, E27): the photo only reaches the server once the drink is
// saved, so the colours image-palette works out there come too late. Shrunk
// to a thumbnail (expo-image-manipulator), read into pixels (jpeg-js).
// lib/photoColours.web.ts does the same with a canvas.

import { decode as fromBase64 } from 'base64-arraybuffer';
import { requireOptionalNativeModule } from 'expo';
import { decode as decodeJpeg } from 'jpeg-js';

import { photoColours } from '@/supabase/functions/_shared/palette';

/** Enough rows to find the colours, few enough to read at once. */
export const COLOUR_ROWS = 120;

/** Up to five colours from the photo at `uri`, the drink's first; none when this build can't shrink a photo. */
export async function readPhotoColours(uri: string): Promise<string[]> {
  // Builds from before Draw my glass lack the module (they get updates over the air): no photo row there.
  if (!requireOptionalNativeModule('ExpoImageManipulator')) return [];
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const small = await manipulateAsync(uri, [{ resize: { height: COLOUR_ROWS } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!small.base64) return [];
  const { width, data } = decodeJpeg(new Uint8Array(fromBase64(small.base64)), { useTArray: true, formatAsRGBA: true });
  return photoColours(data, width);
}
