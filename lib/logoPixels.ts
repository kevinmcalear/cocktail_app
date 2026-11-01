// A logo's pixels, read on the phone for the Colour sheet's pins and colours
// (lib/logoPins.ts): a saved logo is fetched to the cache, shrunk
// (expo-image-manipulator) and read (jpeg-js), as lib/photoColours.ts reads a
// photo. lib/logoPixels.web.ts does the same with a canvas.

import { decode as fromBase64 } from 'base64-arraybuffer';
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeJpeg } from 'jpeg-js';

import { imageExtFromUri } from '@/lib/imageBase64';

/** The small copy's width: enough to place a pin a few points across on a 180 point logo. */
export const LOGO_SAMPLE = 64;

export interface LogoPixels {
  /** RGBA, row by row. A JPEG has no alpha: a clear background comes back black, which no logo colour is near. */
  data: Uint8Array;
  width: number;
  height: number;
}

/** The logo at `uri`, small; null on a build that can't shrink an image. */
export async function readLogoPixels(uri: string): Promise<LogoPixels | null> {
  // Builds from before Draw my glass lack the module (they get updates over the air).
  if (!requireOptionalNativeModule('ExpoImageManipulator')) return null;
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  // The manipulator reads local files: a saved logo is fetched to the cache first, and dropped after.
  const remote = /^https?:/.test(uri);
  const local = remote ? (await FileSystem.downloadAsync(uri, `${FileSystem.cacheDirectory}logo_${Date.now()}.${imageExtFromUri(uri)}`)).uri : uri;
  const small = await manipulateAsync(local, [{ resize: { width: LOGO_SAMPLE } }], { compress: 0.9, format: SaveFormat.JPEG, base64: true }).finally(() => {
    if (remote) void FileSystem.deleteAsync(local, { idempotent: true });
  });
  if (!small.base64) return null;
  const { width, height, data } = decodeJpeg(new Uint8Array(fromBase64(small.base64)), { useTArray: true, formatAsRGBA: true });
  return { data, width, height };
}
