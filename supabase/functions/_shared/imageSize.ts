// Reads an image's width and height from its header, without decoding it, so
// a function can refuse a tiny file that would decode to gigabytes of pixels.
// Pure (no Deno or Node APIs), so the app's unit checks can run it.

/** The most pixels a function will decode: 4096 x 4096. */
export const MAX_IMAGE_PIXELS = 4096 * 4096;
/** The longest side a function will decode. */
export const MAX_IMAGE_SIDE = 8192;

export interface ImageSize {
  format: "png" | "jpeg" | "gif";
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

/** PNG, JPEG or GIF dimensions, or null for anything else or a broken header. */
export function imageSize(b: Uint8Array): ImageSize | null {
  // PNG: signature, then IHDR's width and height.
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { format: "png", width: u32be(b, 16), height: u32be(b, 20) };
  }
  // GIF: logical screen size (each frame must fit inside it).
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { format: "gif", width: u16le(b, 6), height: u16le(b, 8) };
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      // Standalone markers carry no length.
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += 2;
        continue;
      }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { format: "jpeg", height: u16be(b, i + 5), width: u16be(b, i + 7) };
      i += 2 + u16be(b, i + 2);
    }
  }
  return null;
}

/** Whether an image is small enough to decode; unknown formats are not. */
export function decodableSize(b: Uint8Array): boolean {
  const size = imageSize(b);
  return (
    !!size &&
    size.width > 0 &&
    size.height > 0 &&
    size.width <= MAX_IMAGE_SIDE &&
    size.height <= MAX_IMAGE_SIDE &&
    size.width * size.height <= MAX_IMAGE_PIXELS
  );
}
