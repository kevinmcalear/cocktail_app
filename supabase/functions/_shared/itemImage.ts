import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { consumeAiQuota, requireItemEditor, requireUser } from "./auth.ts";
import { generateImagenPng } from "./gemini.ts";
import { HttpError, requireUuid, serveJson } from "./http.ts";
import { ITEM_IMAGE_KINDS, ITEM_SELECT, type ImageItemType, type ItemForPrompt } from "./itemPrompts.ts";

export async function loadItemForPrompt(admin: SupabaseClient, itemId: string): Promise<ItemForPrompt | null> {
  const { data, error } = await admin.from("items").select(ITEM_SELECT).eq("id", itemId).maybeSingle();
  if (error) throw error;
  return data as unknown as ItemForPrompt | null;
}

/**
 * Draws a sketch of the item and uploads it; returns its public URL. The
 * caller attaches it with attach_generated_item_image.
 */
export async function drawItemSketch(admin: SupabaseClient, item: ItemForPrompt, type: ImageItemType): Promise<string> {
  const kind = ITEM_IMAGE_KINDS[type];
  const png = await generateImagenPng(kind.buildPrompt(item));

  const path = `${kind.folder}/${item.id}/${Date.now()}.png`;
  const bucket = admin.storage.from("drinks");
  const { error } = await bucket.upload(path, png, { contentType: "image/png", cacheControl: "3600", upsert: false });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

interface GeneratorOptions {
  /** Function name, used for logs and the AI quota. */
  name: string;
  /** Request body field holding the item id. */
  idField: string;
  itemType: ImageItemType;
}

/**
 * Serves the Generate button: draws a sketch for one item right away and saves
 * it as a hero sketch. Only someone allowed to edit the item may call it, and
 * each call spends one unit of the caller's daily AI quota. (Automatic sketches
 * come from the image-worker function, billed to the venue.)
 */
export function serveItemImageGenerator(options: GeneratorOptions): void {
  serveJson(options.name, async (req) => {
    const caller = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const itemId = requireUuid(body?.[options.idField], options.idField);
    await requireItemEditor(caller, itemId);

    const item = await loadItemForPrompt(caller.admin, itemId);
    if (!item) throw new HttpError(404, "That item doesn't exist.");
    if (item.item_type !== options.itemType) {
      throw new HttpError(400, `That item is not a ${options.itemType}.`);
    }

    await consumeAiQuota(caller, options.name);
    const imageUrl = await drawItemSketch(caller.admin, item, options.itemType);

    const { error } = await caller.admin.rpc("attach_generated_item_image", { p_item_id: itemId, p_url: imageUrl });
    if (error) throw error;

    return { success: true, imageUrl };
  });
}
