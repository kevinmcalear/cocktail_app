// Smaller copies of drink pictures, and their ThumbHash. List-sized copies: A 56 pt row or a grid tile showed the
// original photo (often 2-3 MB at 3000 px); a 480 px JPEG is about 50 KB and
// looks the same at that size. Made by image-palette as each picture arrives
// and by scripts/backfill-thumbnails.ts for older ones. The app finds a
// thumbnail by its path (lib/thumbnails.ts thumbUrl, which must agree with
// thumbPath) and falls back to the original until it exists.
import { Image } from "jsr:@matmen/imagescript@1.3.1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { rgbaToThumbHash } from "npm:thumbhash@0.1.1";

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

/** The page copy's width: a drink page at 3x (lib/thumbnails.ts). */
export const PAGE_WIDTH = 1080;

/** "cocktails/abc/1.jpg" -> "cocktails/abc/1@1080.jpg", beside the original (lib/thumbnails.ts pageCopyPath). */
export function pageCopyPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot > path.lastIndexOf("/") ? `${path.slice(0, dot)}@1080${path.slice(dot)}` : `${path}@1080`;
}

function toImage(pixels: { rgba: ArrayLike<number>; width: number; height: number }): Image {
  const image = new Image(pixels.width, pixels.height);
  image.bitmap.set(pixels.rgba);
  return image;
}

/**
 * Saves a picture's page copy: no wider than PAGE_WIDTH, in the original's
 * own type (a PNG cut-out stays clear). Always saved, even for a narrower
 * picture, since the app asks for it by path once images.thumbhash is set.
 */
export async function savePageCopy(admin: SupabaseClient, path: string, pixels: { rgba: ArrayLike<number>; width: number; height: number }): Promise<string> {
  const image = toImage(pixels);
  if (image.width > PAGE_WIDTH) image.resize(PAGE_WIDTH, Image.RESIZE_AUTO);
  const png = /\.png$/i.test(path);
  const bytes = png ? await image.encode() : await image.encodeJPEG(80);
  const target = pageCopyPath(path);
  const { error } = await admin.storage.from("drinks").upload(target, bytes, { contentType: png ? "image/png" : "image/jpeg", cacheControl: "31536000", upsert: true });
  if (error) throw error;
  return target;
}

/** A picture's ThumbHash, base64, as expo-image's placeholder takes it: from a copy at most 100 px a side, as ThumbHash needs. */
export function thumbHashOf(pixels: { rgba: ArrayLike<number>; width: number; height: number }): string {
  const image = toImage(pixels);
  const scale = 100 / Math.max(image.width, image.height);
  if (scale < 1) image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
  const hash = rgbaToThumbHash(image.width, image.height, image.bitmap);
  return btoa(String.fromCharCode(...hash));
}
