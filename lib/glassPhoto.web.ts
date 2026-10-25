// A photo of a glass for Draw my glass, on the web: chosen or dropped,
// drawn on a canvas about 1,000 px tall, read into pixels for the tracer and
// kept as a JPEG. lib/glassPhoto.ts is the phone's.

import * as ImagePicker from 'expo-image-picker';

import type { GlassPhoto } from './glassPhoto';

export type { GlassPhoto } from './glassPhoto';

export const PHOTO_ROWS = 1000;

export function canDrawGlass(): boolean {
  return true;
}

export async function pickGlassPhoto(from: 'camera' | 'library'): Promise<GlassPhoto | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'] };
  const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  return asset ? readGlassPhoto(asset.uri) : null;
}

/** A photo at a URI (a chosen or dropped file), drawn on a canvas and read. */
export async function readGlassPhoto(src: string): Promise<GlassPhoto> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch {
    throw new Error('Couldn’t open that photo. Try a JPG or PNG.');
  }
  const k = Math.min(1, PHOTO_ROWS / img.naturalHeight);
  const width = Math.round(img.naturalWidth * k);
  const height = Math.round(img.naturalHeight * k);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Couldn’t open that photo. Try another.');
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Couldn’t open that photo. Try another.');
  return { uri: URL.createObjectURL(blob), width, height, pixels: { width, height, data }, jpeg: await blob.arrayBuffer() };
}
