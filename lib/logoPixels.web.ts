// The web's lib/logoPixels.ts: the logo drawn small on a canvas and read.

export const LOGO_SAMPLE = 64;

export interface LogoPixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** The logo at `uri`, small; null when the browser won't let a page read it (no CORS) or it isn't an image. */
export async function readLogoPixels(uri: string): Promise<LogoPixels | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = uri;
    await img.decode();
    const k = LOGO_SAMPLE / Math.max(img.naturalWidth, img.naturalHeight);
    const width = Math.max(1, Math.round(img.naturalWidth * k));
    const height = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height).data, width, height };
  } catch {
    return null;
  }
}
