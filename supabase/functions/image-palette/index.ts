// Computes the drink-field palette for one `images` row and saves it.
//
// Called by the database (a trigger on `images` insert, through pg_net) and by
// scripts/backfill-palettes.mjs, never by the app. Both send the shared
// IMAGE_PALETTE_SECRET instead of a user session.
//
// POST { image_id, force? } -> { palette }  ([] when the picture has no colour)
import { decode, GIF } from "jsr:@matmen/imagescript@1.3.1";
import { createClient } from "npm:@supabase/supabase-js@2";

import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { pickPalette } from "../_shared/palette.ts";

/** Photos from the app are a few hundred KB; anything this big is not a drink photo. */
const MAX_BYTES = 12 * 1024 * 1024;
/** Only our own public drink pictures, never an arbitrary URL. */
const STORAGE_PATH = /\/storage\/v1\/object\/public\/drinks\/(.+)$/;

serveJson("image-palette", async (req) => {
  const secret = Deno.env.get("IMAGE_PALETTE_SECRET");
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

  const decoded = await decode(new Uint8Array(await blob.arrayBuffer()), true).catch(() => null);
  if (!decoded) throw new HttpError(422, "The image could not be decoded.");
  // ponytail: imagescript reads PNG, JPEG, GIF and TIFF. WebP and HEIC fail
  // above and keep a null palette; the app only uploads JPEG and PNG today.
  const frame = decoded instanceof GIF ? decoded[0] : decoded;
  const palette = pickPalette(frame.bitmap, frame.width);

  const { error: updateError } = await admin.from("images").update({ palette }).eq("id", imageId);
  if (updateError) throw updateError;
  return { palette };
});

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}
