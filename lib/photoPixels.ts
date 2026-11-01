// A photo read into pixels on the phone, small: shrunk with
// expo-image-manipulator, then decoded (jpeg-js). For what's worked out from a
// photo before it reaches the server: its colours (lib/photoColours.ts) and
// its layout at upload (components/drink/drinkImages.ts).
// lib/photoPixels.web.ts does the same with a canvas.

import { decode as fromBase64 } from 'base64-arraybuffer';
import { requireOptionalNativeModule } from 'expo';
import { decode as decodeJpeg } from 'jpeg-js';

export interface Pixels {
  rgba: ArrayLike<number>;
  width: number;
  height: number;
}

/** The photo at `uri` shrunk to `size` (one side; the other keeps its shape), or null when this build can't shrink a photo. */
export async function readPhotoPixels(uri: string, size: { width: number } | { height: number }): Promise<Pixels | null> {
  // Builds from before Draw my glass lack the module (they get updates over the air).
  if (!requireOptionalNativeModule('ExpoImageManipulator')) return null;
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const small = await manipulateAsync(uri, [{ resize: size }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!small.base64) return null;
  const { width, height, data } = decodeJpeg(new Uint8Array(fromBase64(small.base64)), { useTArray: true, formatAsRGBA: true });
  return { rgba: data, width, height };
}
