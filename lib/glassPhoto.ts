// A photo of a glass for Draw my glass, on a phone: from the camera or the
// library, shrunk to about 1,000 px tall (expo-image-manipulator) and read
// into pixels (jpeg-js) so the tracer runs on the phone, no upload needed to
// trace it. lib/glassPhoto.web.ts does the same with a canvas.

import { decode as fromBase64 } from 'base64-arraybuffer';
import { requireOptionalNativeModule } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import { decode as decodeJpeg } from 'jpeg-js';

import type { TracePixels } from './glassTrace';
import { canUseCamera } from './photoAccess';

/** A photo ready to trace, and to keep (the JPEG, at the size it was traced). */
export interface GlassPhoto {
  uri: string;
  width: number;
  height: number;
  pixels: TracePixels;
  jpeg: ArrayBuffer;
}

// Tall enough for a 2% width, small enough to read quickly and keep.
export const PHOTO_ROWS = 1000;

/**
 * Whether this build can shrink a photo. Builds from before Draw my glass
 * lack the native module and get updates over the air: they offer Name your
 * own only.
 */
export function canDrawGlass(): boolean {
  return !!requireOptionalNativeModule('ExpoImageManipulator');
}

/** A photo from the camera or the library, shrunk and read. Null when cancelled. */
export async function pickGlassPhoto(from: 'camera' | 'library'): Promise<GlassPhoto | null> {
  if (from === 'camera' && !(await canUseCamera())) return null;
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
  const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  return asset ? readGlassPhoto(asset.uri, asset.height) : null;
}

/** A photo at a URI, shrunk and read. */
export async function readGlassPhoto(uri: string, rows = Infinity): Promise<GlassPhoto> {
  // Loaded only here: importing it on a build without the module throws.
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const small = await manipulateAsync(uri, rows > PHOTO_ROWS ? [{ resize: { height: PHOTO_ROWS } }] : [], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
  if (!small.base64) throw new Error('Couldn’t open that photo. Try another.');
  const jpeg = fromBase64(small.base64);
  const { width, height, data } = decodeJpeg(new Uint8Array(jpeg), { useTArray: true, formatAsRGBA: true });
  return { uri: small.uri, width, height, pixels: { width, height, data }, jpeg };
}
