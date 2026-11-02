// The web's lib/photoPixels.ts: the photo drawn small on a canvas and read.

import type { PhotoPixels } from './photoPixels';

export type { PhotoPixels };

export async function readPhotoPixels(uri: string, rows: number): Promise<PhotoPixels | null> {
  const img = new Image();
  // Storage serves pictures to any site, so a photo from it can be read back off the canvas.
  if (/^https?:/.test(uri)) img.crossOrigin = 'anonymous';
  img.src = uri;
  await img.decode();
  const k = Math.min(1, rows / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * k));
  const height = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width };
}
