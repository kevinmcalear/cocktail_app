import { consumeAiQuota, requireItemEditor, requireUser } from "./auth.ts";
import { generateImagenPng } from "./gemini.ts";
import { HttpError, requireUuid, serveJson } from "./http.ts";

interface Named {
  name: string;
}

export interface ItemForPrompt {
  id: string;
  name: string;
  item_type: string;
  description: string | null;
  brand_maker: string | null;
  origin: string | null;
  abv: number | null;
  glassware: Named | null;
  ice: Named | null;
  item_methods: { sort_order: number | null; method: Named | null }[];
  recipes: { amount: number | null; unit: string | null; sort_order: number; ingredient: Named | null }[];
}

const ITEM_SELECT = `
  id, name, item_type, description, brand_maker, origin, abv,
  glassware:items!glassware_id(name),
  ice:items!ice_id(name),
  item_methods!item_methods_item_id_fkey(sort_order, method:items!item_methods_method_item_id_fkey(name)),
  recipes!new_recipes_recipe_item_id_fkey(amount, unit, sort_order, ingredient:items!new_recipes_ingredient_item_id_fkey(name))
`;

/** Shared tail of every prompt: the house illustration style. */
export const HOUSE_STYLE =
  "The style is inspired by premium minimalist bars like Caretaker's Cottage: understated elegance. " +
  "Visible messy sketch lines, overlapping pencil strokes. " +
  "The background MUST be a perfectly clean, uniform, flat light paper texture with absolutely no sketchbook edges, " +
  "no binder rings, and no borders. NO TEXT ANYWHERE. No words. Extremely sophisticated but intentionally rough and unfinished.";

export function ingredientNames(item: ItemForPrompt): string[] {
  return [...item.recipes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.ingredient?.name)
    .filter((name): name is string => !!name);
}

interface GeneratorOptions {
  /** Function name, used for logs and the AI quota. */
  name: string;
  /** Request body field holding the item id. */
  idField: string;
  itemType: "cocktail" | "ingredient" | "beer" | "wine";
  /** Top-level storage folder in the drinks bucket. */
  folder: string;
  buildPrompt: (item: ItemForPrompt) => string;
}

/**
 * Serves an endpoint that draws an illustration for one item and attaches it.
 * Only someone allowed to edit the item may call it, and each call spends one
 * unit of the caller's daily AI quota.
 */
export function serveItemImageGenerator(options: GeneratorOptions): void {
  serveJson(options.name, async (req) => {
    const caller = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const itemId = requireUuid(body?.[options.idField], options.idField);
    await requireItemEditor(caller, itemId);

    const { data, error } = await caller.admin.from("items").select(ITEM_SELECT).eq("id", itemId).single();
    if (error) throw error;
    const item = data as unknown as ItemForPrompt;
    if (item.item_type !== options.itemType) {
      throw new HttpError(400, `That item is not a ${options.itemType}.`);
    }

    await consumeAiQuota(caller, options.name);
    const png = await generateImagenPng(options.buildPrompt(item));

    const path = `${options.folder}/${itemId}/${Date.now()}.png`;
    const bucket = caller.admin.storage.from("drinks");
    const { error: uploadError } = await bucket.upload(path, png, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const imageUrl = bucket.getPublicUrl(path).data.publicUrl;

    const { data: image, error: imageError } = await caller.admin
      .from("images")
      .insert({ url: imageUrl })
      .select("id")
      .single();
    if (imageError) throw imageError;

    const { error: linkError } = await caller.admin.from("item_images").insert({ item_id: itemId, image_id: image.id });
    if (linkError) throw linkError;

    return { success: true, imageUrl };
  });
}
