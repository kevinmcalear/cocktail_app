/** Over this mean lightness (0 to 1) a photo reads as bright: a pale ground, a white bar top. */
export const BRIGHT_AT = 0.6;

/**
 * Whether a photo makes a light page or a dark one (Menu-g-photo-bright,
 * Menu-g-photo-dark): the mean lightness of its pixels, RGBA in a row as a
 * canvas or jpeg-js gives them. Transparent pixels are skipped; no pixels at
 * all reads as dark, the way glass over any photo did before.
 */
export function photoTone(rgba: ArrayLike<number>): 'light' | 'dark' {
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    sum += (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
    n += 1;
  }
  return n && sum / n > BRIGHT_AT ? 'light' : 'dark';
}
