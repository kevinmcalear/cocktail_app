// The web's lib/photoColours.ts: the photo drawn small on a canvas and read.

import { photoColours } from '@/supabase/functions/_shared/palette';

export const COLOUR_ROWS = 120;

export async function readPhotoColours(uri: string): Promise<string[]> {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const k = Math.min(1, COLOUR_ROWS / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * k));
  const height = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, width, height);
  return photoColours(ctx.getImageData(0, 0, width, height).data, width);
}
