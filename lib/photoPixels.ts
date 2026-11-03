// A photo read into pixels on the phone: shrunk to a few rows
// (expo-image-manipulator, which loads local files and web addresses alike),
// then decoded (jpeg-js). lib/photoPixels.web.ts does the same with a canvas.

import { decode as fromBase64 } from 'base64-arraybuffer';
import { requireOptionalNativeModule } from 'expo';
import { decode as decodeJpeg } from 'jpeg-js';

export interface PhotoPixels {
  /** RGBA, row after row. */
  data: Uint8Array | Uint8ClampedArray;
  width: number;
}

/** The photo at `uri`, `rows` tall; null when this build can't shrink a photo. */
export async function readPhotoPixels(uri: string, rows: number): Promise<PhotoPixels | null> {
  // Builds from before Draw my glass lack the module (they get updates over the air).
  if (!requireOptionalNativeModule('ExpoImageManipulator')) return null;
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const small = await manipulateAsync(uri, [{ resize: { height: rows } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!small.base64) return null;
  const { width, data } = decodeJpeg(new Uint8Array(fromBase64(small.base64)), { useTArray: true, formatAsRGBA: true });
  return { data, width };
}
