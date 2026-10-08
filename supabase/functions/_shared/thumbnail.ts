// List-sized copies of drink pictures. A 56 pt row or a grid tile showed the
// original photo (often 2-3 MB at 3000 px); a 480 px JPEG is about 50 KB and
// looks the same at that size. Made by image-palette as each picture arrives
// and by scripts/backfill-thumbnails.ts for older ones. The app finds a
// thumbnail by its path (lib/thumbnails.ts thumbUrl, which must agree with
// thumbPath) and falls back to the original until it exists.
import { Image } from "jsr:@matmen/imagescript@1.3.1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Wide enough for a two-column grid tile at 3x; list rows are smaller. */
export const THUMB_WIDTH = 480;

/** "cocktails/abc/123.png" -> "thumbs/cocktails/abc/123.jpg", in the same drinks bucket. */
export function thumbPath(path: string): string {
  return `thumbs/${path.replace(/\.[^./]+$/, "")}.jpg`;
}

/** A JPEG no wider than THUMB_WIDTH from RGBA pixels. */
export async function thumbnailJpeg(rgba: ArrayLike<number>, width: number, height: number): Promise<Uint8Array> {
  const image = new Image(width, height);
  image.bitmap.set(rgba);
  if (width > THUMB_WIDTH) image.resize(THUMB_WIDTH, Image.RESIZE_AUTO);
  return await image.encodeJPEG(75);
}

/**
 * Saves the thumbnail for a picture at `path` in the drinks bucket. Cached
 * for a year: a picture's path never gets new bytes (uploads always make a
 * new path), so neither does its thumbnail's.
 */
export async function saveThumbnail(admin: SupabaseClient, path: string, pixels: { rgba: ArrayLike<number>; width: number; height: number }): Promise<string> {
  const jpeg = await thumbnailJpeg(pixels.rgba, pixels.width, pixels.height);
  const target = thumbPath(path);
  const { error } = await admin.storage.from("drinks").upload(target, jpeg, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true });
  if (error) throw error;
  return target;
}
