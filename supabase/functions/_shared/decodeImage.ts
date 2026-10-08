// Decoding drink pictures to RGBA in Deno, for image-palette and
// scripts/backfill-thumbnails.ts.
import { decode, GIF } from "jsr:@matmen/imagescript@1.3.1";
import decodeWebp, { init as initWebp } from "npm:@jsquash/webp@1.5.0/decode.js";

/**
 * RGBA pixels of a PNG, JPEG, GIF (first frame), TIFF or WebP, or null when
 * the bytes aren't one of those.
 * ponytail: HEIC and AVIF still fail and keep a null palette; the app uploads
 * JPEG and PNG, and WebP only arrives from elsewhere.
 */
export async function decodePixels(buffer: ArrayBuffer): Promise<{ rgba: ArrayLike<number>; width: number; height: number } | null> {
  const bytes = new Uint8Array(buffer);
  if (isWebp(bytes)) {
    await loadWebpDecoder();
    const image = await decodeWebp(buffer).catch(() => null);
    return image && { rgba: image.data, width: image.width, height: image.height };
  }
  const decoded = await decode(bytes, true).catch(() => null);
  if (!decoded) return null;
  const frame = decoded instanceof GIF ? decoded[0] : decoded;
  return { rgba: frame.bitmap, width: frame.width, height: frame.height };
}

/** "RIFF" <size> "WEBP": the WebP container, lossy or lossless. */
function isWebp(bytes: Uint8Array): boolean {
  const tag = (from: number) => String.fromCharCode(...bytes.subarray(from, from + 4));
  return bytes.length >= 12 && tag(0) === "RIFF" && tag(8) === "WEBP";
}

let webpDecoder: Promise<void> | null = null;

/**
 * Loads libwebp (jSquash's WASM build) on the first WebP only, so PNG and JPEG
 * requests never pay for it. The .wasm is read from inside the npm package, as
 * Supabase's magick-wasm example does, so deploys bundle it with the function.
 */
function loadWebpDecoder(): Promise<void> {
  webpDecoder ??= Deno.readFile(new URL("codec/dec/webp_dec.wasm", import.meta.resolve("npm:@jsquash/webp@1.5.0")))
    .then((wasm) => WebAssembly.compile(wasm))
    .then((module) => initWebp(module))
    .catch((err) => {
      webpDecoder = null; // try again on the next request
      throw err;
    });
  return webpDecoder;
}
