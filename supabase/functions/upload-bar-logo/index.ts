// Stores a venue's logo (or home-screen icon) and suggests colours from it.
//
// POST { bar_id, image_base64, extract_only? } -> { imageUrl, primaryColor, secondaryColor }
//   The image is stored re-encoded as a real PNG, at most MAX_SIDE on a side,
//   named with its edge (_shared/logoEdge.ts) so the app can draw it without
//   a ring around it.
// POST { action: "remove_background", bar_id, logo_url } -> { imageUrl, originalUrl }
//   Takes a flat background out of one of the venue's stored logos and stores
//   the result beside the original (which stays, for "Use original"). 422 when
//   there's no flat background to take out.
// People with the edit brand permission at the venue only.
import { decode, GIF, Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

import { type Caller, requireUser } from "../_shared/auth.ts";
import { drinksBucketUrl } from "../_shared/drinksUrl.ts";
import { HttpError, serveJson } from "../_shared/http.ts";
import { decodableSize } from "../_shared/imageSize.ts";
import { logoEdge, logoFileTag, noBackgroundPath, removeLogoBackground } from "../_shared/logoEdge.ts";

/** A logo's largest decoded file size: 5 MB, the same as the avatars bucket. */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
/** The longest side a stored logo keeps: sharp at the largest place it's drawn (the 512 home-screen icon), with room to spare. */
const MAX_SIDE = 1024;
/** Each stored logo has its own path, so it can be cached for a year. */
const CACHE_A_YEAR = "31536000";
const PUBLIC_DRINKS = "/storage/v1/object/public/drinks/";

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function bucketKey(r: number, g: number, b: number, step = 24): string {
  const br = Math.min(255, Math.round(r / step) * step);
  const bg = Math.min(255, Math.round(g / step) * step);
  const bb = Math.min(255, Math.round(b / step) * step);
  return `${br},${bg},${bb}`;
}

function extractBrandColors(image: Image): { primaryColor: string; secondaryColor: string } {
  const size = 64;
  // resize() changes the image it's called on: work on a copy.
  const resized = image.clone().resize(size, size);

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let y = 1; y <= size; y++) {
    for (let x = 1; x <= size; x++) {
      const pixel = resized.getPixelAt(x, y);
      const a = pixel & 0xff;
      const b = (pixel >> 8) & 0xff;
      const g = (pixel >> 16) & 0xff;
      const r = (pixel >> 24) & 0xff;

      if (a < 128) continue;
      if (r > 245 && g > 245 && b > 245) continue;
      if (r < 20 && g < 20 && b < 20) continue;

      const key = bucketKey(r, g, b);
      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }
  }

  const sorted = [...buckets.values()].sort((left, right) => right.count - left.count);
  const primaryEntry = sorted[0] ?? { r: 136, g: 136, b: 136, count: 0 };
  const primaryColor = rgbToHex(primaryEntry.r, primaryEntry.g, primaryEntry.b);

  const secondaryEntry =
    sorted.find((entry, index) => index > 0 && colorDistance(entry, primaryEntry) > 60) ??
    sorted[1] ??
    primaryEntry;
  const secondaryColor = rgbToHex(secondaryEntry.r, secondaryEntry.g, secondaryEntry.b);

  return { primaryColor, secondaryColor };
}

/** PNG, JPEG or GIF (its first frame) bytes as an image no longer than MAX_SIDE on a side. */
async function decodeLogo(bytes: Uint8Array): Promise<Image> {
  // A small file can still decode to an enormous bitmap: check the header first.
  if (!decodableSize(bytes)) throw new HttpError(400, "Use a PNG, JPEG or GIF logo up to 4096 by 4096 pixels.");
  const decoded = await decode(bytes, true).catch(() => null);
  let image: Image;
  if (decoded instanceof GIF && decoded[0]) {
    // A GIF's first frame, as a plain image.
    image = new Image(decoded[0].width, decoded[0].height);
    image.bitmap.set(decoded[0].bitmap);
  } else if (decoded instanceof Image) image = decoded;
  else throw new HttpError(400, "That logo isn't a readable image.");
  const scale = MAX_SIDE / Math.max(image.width, image.height);
  return scale < 1 ? image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale))) : image;
}

/**
 * Only people with the edit brand permission at the venue (an Admin's by
 * default; a venue can give it to any role). my_capabilities is empty once a
 * role has ended, like the bars_update policy and its brand guard.
 */
async function requireBrandEditor(caller: Caller, barId: string): Promise<void> {
  const { data, error } = await caller.userClient.rpc("my_capabilities", { p_bar_id: barId });
  if (error || !Array.isArray(data) || !data.includes("brand")) {
    throw new HttpError(403, "Only people who can edit the venue's brand can change its logo.");
  }
}

async function storePng(caller: Caller, path: string, png: Uint8Array, upsert: boolean): Promise<string> {
  const bucket = caller.admin.storage.from("drinks");
  const { error } = await bucket.upload(path, png, { contentType: "image/png", cacheControl: CACHE_A_YEAR, upsert });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Takes the flat background out of one of this venue's stored logos and stores the result beside it. */
async function removeBackground(caller: Caller, barId: string, logoUrl: unknown) {
  const url = typeof logoUrl === "string" ? drinksBucketUrl(logoUrl, Deno.env.get("SUPABASE_URL") ?? "") : null;
  const path = url ? decodeURIComponent(new URL(url).pathname).slice(PUBLIC_DRINKS.length) : "";
  // Only this venue's own uploads (all PNGs), never another venue's or another bucket's file.
  if (!path.startsWith(`bars/${barId}/`) || !/^bars\/[0-9a-f-]{36}\/[\w.-]+\.png$/i.test(path)) {
    throw new HttpError(422, "Upload the logo again, then remove its background.");
  }
  const { data: blob, error } = await caller.admin.storage.from("drinks").download(path);
  if (error || !blob) throw new HttpError(404, "Couldn't find that logo. Upload it again.");
  if (blob.size > MAX_LOGO_BYTES) throw new HttpError(413, "That logo is too large. Use an image under 5 MB.");

  const image = await decodeLogo(new Uint8Array(await blob.arrayBuffer()));
  if (logoEdge(image.bitmap, image.width, image.height).kind === "clear") {
    throw new HttpError(422, "This logo already has a transparent background.");
  }
  if (!removeLogoBackground(image.bitmap, image.width, image.height)) {
    throw new HttpError(422, "This logo has no plain background to remove. Upload a PNG with a transparent background instead.");
  }
  // The same original always gives the same result, so trying again just replaces it.
  const imageUrl = await storePng(caller, noBackgroundPath(path), await image.encode(), true);
  return { imageUrl, originalUrl: url };
}

serveJson("upload-bar-logo", async (req) => {
  const caller = await requireUser(req);

  const body = await req.json().catch(() => ({}));
  const { bar_id, image_base64, extract_only = false } = body;
  if (body.action === "remove_background") {
    if (typeof bar_id !== "string" || !bar_id) throw new HttpError(400, "bar_id and logo_url are required");
    await requireBrandEditor(caller, bar_id);
    return await removeBackground(caller, bar_id, body.logo_url);
  }
  if (typeof bar_id !== "string" || typeof image_base64 !== "string" || !bar_id || !image_base64) {
    throw new HttpError(400, "bar_id and image_base64 are required");
  }
  // Base64 is 4 characters per 3 bytes; refuse before decoding anything.
  if (image_base64.length > Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 4) {
    throw new HttpError(413, "That logo is too large. Use an image under 5 MB.");
  }

  await requireBrandEditor(caller, bar_id);

  let binaryStr: string;
  try {
    binaryStr = atob(image_base64);
  } catch {
    throw new HttpError(400, "That logo isn't a readable image.");
  }
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  if (bytes.length > MAX_LOGO_BYTES) {
    throw new HttpError(413, "That logo is too large. Use an image under 5 MB.");
  }

  const image = await decodeLogo(bytes);
  const { primaryColor, secondaryColor } = extractBrandColors(image);

  if (extract_only) {
    return { primaryColor, secondaryColor };
  }

  // Always a real PNG (it keeps transparency and says what it is), named with its edge.
  const edge = logoEdge(image.bitmap, image.width, image.height);
  const imageUrl = await storePng(caller, `bars/${bar_id}/${Date.now()}.${logoFileTag(edge)}.png`, await image.encode(), false);
  return { imageUrl, primaryColor, secondaryColor };
});
