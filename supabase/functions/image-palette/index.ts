// Computes the drink-field palette for one `images` row and saves it.
//
// Called by the database (a trigger on `images` insert, through pg_net) and by
// scripts/backfill-palettes.mjs, never by the app. Both send the shared
// IMAGE_PALETTE_SECRET instead of a user session; a local stack falls back to
// a fixed local secret.
//
// POST { image_id, force? } -> { palette }  ([] when the picture has no colour)
import { decode, GIF } from "jsr:@matmen/imagescript@1.3.1";
import decodeWebp, { init as initWebp } from "npm:@jsquash/webp@1.5.0/decode.js";
import { createClient } from "npm:@supabase/supabase-js@2";

import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { isLocalStack, LOCAL_IMAGE_PALETTE_SECRET } from "../_shared/localStack.ts";
import { pickPalette } from "../_shared/palette.ts";

/** Photos from the app are a few hundred KB; anything this big is not a drink photo. */
const MAX_BYTES = 12 * 1024 * 1024;
/** Only our own public drink pictures, never an arbitrary URL. */
const STORAGE_PATH = /\/storage\/v1\/object\/public\/drinks\/(.+)$/;

serveJson("image-palette", async (req) => {
  const secret = Deno.env.get("IMAGE_PALETTE_SECRET") || (isLocalStack() ? LOCAL_IMAGE_PALETTE_SECRET : "");
  if (!secret || !timingSafeEqual(req.headers.get("x-image-palette-secret") ?? "", secret)) {
    throw new HttpError(401, "Not allowed.");
  }

  const body = await req.json().catch(() => ({}));
  const imageId = requireUuid(body?.image_id, "image_id");
  const force = body?.force === true;

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: image, error } = await admin.from("images").select("id, url, palette").eq("id", imageId).maybeSingle();
  if (error) throw error;
  if (!image) throw new HttpError(404, "No such image.");
  if (image.palette !== null && !force) return { palette: image.palette, skipped: true };

  const path = new URL(image.url).pathname.match(STORAGE_PATH)?.[1];
  if (!path) throw new HttpError(422, "The image is not in the drinks bucket.");

  const { data: blob, error: downloadError } = await admin.storage.from("drinks").download(decodeURIComponent(path));
  if (downloadError) throw downloadError;
  if (blob.size > MAX_BYTES) throw new HttpError(422, "The image is too large.");

  const pixels = await decodePixels(await blob.arrayBuffer());
  if (!pixels) throw new HttpError(422, "The image could not be decoded.");
  const palette = pickPalette(pixels.rgba, pixels.width);

  // Only if the row still shows this picture. When url changed meanwhile, the
  // database has already asked for the new picture's palette; don't overwrite
  // it with this stale one.
  const { data: saved, error: updateError } = await admin
    .from("images")
    .update({ palette })
    .eq("id", imageId)
    .eq("url", image.url)
    .select("id");
  if (updateError) throw updateError;
  if (saved.length === 0) return { palette: null, stale: true };
  return { palette };
});

/**
 * RGBA pixels of a PNG, JPEG, GIF (first frame), TIFF or WebP, or null when
 * the bytes aren't one of those.
 * ponytail: HEIC and AVIF still fail and keep a null palette; the app uploads
 * JPEG and PNG, and WebP only arrives from elsewhere.
 */
async function decodePixels(buffer: ArrayBuffer): Promise<{ rgba: ArrayLike<number>; width: number } | null> {
  const bytes = new Uint8Array(buffer);
  if (isWebp(bytes)) {
    await loadWebpDecoder();
    const image = await decodeWebp(buffer).catch(() => null);
    return image && { rgba: image.data, width: image.width };
  }
  const decoded = await decode(bytes, true).catch(() => null);
  if (!decoded) return null;
  const frame = decoded instanceof GIF ? decoded[0] : decoded;
  return { rgba: frame.bitmap, width: frame.width };
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

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}
