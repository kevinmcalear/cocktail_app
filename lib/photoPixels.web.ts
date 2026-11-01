// The web's lib/photoPixels.ts: the photo drawn small on a canvas and read.

import type { Pixels } from './photoPixels';

export type { Pixels };

export async function readPhotoPixels(uri: string, size: { width: number } | { height: number }): Promise<Pixels | null> {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const k = Math.min(1, 'width' in size ? size.width / img.naturalWidth : size.height / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * k));
  const height = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return { rgba: ctx.getImageData(0, 0, width, height).data, width, height };
}
