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
  bar_id: string | null;
  glassware: Named | null;
  ice: Named | null;
  item_methods: { sort_order: number | null; method: Named | null }[];
  recipes: { amount: number | null; unit: string | null; sort_order: number; ingredient: Named | null }[];
}

export type ImageItemType = "cocktail" | "ingredient" | "beer" | "wine";

export const ITEM_SELECT = `
  id, name, item_type, description, brand_maker, origin, abv, bar_id,
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

// Recipe units that describe something set on or in the glass rather than
// poured (see lib/units.ts), so the sketch draws them as the garnish.
const GARNISH_UNITS = new Set(["peel", "twist", "wheel", "slice", "sprig", "leaf"]);

function sortedRecipes(item: ItemForPrompt) {
  return [...item.recipes].sort((a, b) => a.sort_order - b.sort_order);
}

export function ingredientNames(item: ItemForPrompt): string[] {
  return sortedRecipes(item)
    .map((r) => r.ingredient?.name)
    .filter((name): name is string => !!name);
}

function cocktailPrompt(cocktail: ItemForPrompt): string {
  const glass = cocktail.glassware?.name ?? "glass";
  const methods = [...cocktail.item_methods]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((m) => m.method?.name)
    .filter(Boolean)
    .join(" and ");
  const recipes = sortedRecipes(cocktail).filter((r) => r.ingredient?.name);
  const garnishes = recipes
    .filter((r) => r.unit && GARNISH_UNITS.has(r.unit))
    .map((r) => `${r.ingredient!.name} ${r.unit}`);
  const liquids = recipes.filter((r) => !r.unit || !GARNISH_UNITS.has(r.unit)).map((r) => r.ingredient!.name);

  const details = [
    `${cocktail.name} cocktail inside a ${glass}.`,
    `${methods || "Prepared"} liquid.`,
    cocktail.ice ? `${cocktail.ice.name} ice.` : "",
    liquids.length ? `Contains: ${liquids.join(", ")}.` : "",
    garnishes.length ? `Garnished with ${garnishes.join(" and ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist ${cocktail.name} cocktail. ` +
    `${details} PERFECT professional wash line, filled just a finger-width below the rim. ` +
    `The liquid must look very clean, light, and refreshing. ${HOUSE_STYLE}`
  );
}

function ingredientPrompt(ingredient: ItemForPrompt): string {
  // House-made ingredients (syrups, infusions) have their own recipe; hint at it.
  const parts = ingredientNames(ingredient).slice(0, 3);
  const accent = parts.length
    ? `Incorporate very subtle, faint visual hints of ${parts.join(", ")} nearby as sub-ingredients`
    : "Incorporate a very delicate, elegant bar tool (like a small silver measuring spoon, picking tongs, or a single pristine ice cube) nearby as a subtle accent";

  return (
    `A very rough, sketchy, unfinished hand-drawn pencil illustration of ${ingredient.name}. ` +
    "The style is inspired by premium minimalist bars like Caretaker's Cottage: understated elegance. " +
    "Visible messy sketch lines everywhere, overlapping pencil strokes, very rough and unfinished sketch-wise. " +
    `${accent}, and ONLY very subtle, muted, toned-down watercolor washes (use colors appropriate for ${ingredient.name}) ` +
    "for a slight hint of color, not fully colored in. The background MUST be a perfectly clean, uniform, flat light " +
    "paper texture with absolutely no sketchbook edges, no binder rings, and no borders. NO TEXT ANYWHERE. No words. " +
    "Extremely sophisticated, elegant, but intentionally rough and sketchy."
  );
}

function beerPrompt(beer: ItemForPrompt): string {
  const details = [beer.brand_maker ? `by ${beer.brand_maker}` : "", beer.abv ? `${beer.abv}% ABV` : ""].filter(Boolean);

  return (
    `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist craft beer: ${beer.name}. ` +
    `${details.length ? details.join(", ") : "Craft beer"}. ` +
    `PERFECT professional pour, served in an elegant appropriate beer glass for the style. ` +
    `The liquid must look very authentic and refreshing. ${HOUSE_STYLE}`
  );
}

function winePrompt(wine: ItemForPrompt): string {
  const details = [wine.origin ? `from ${wine.origin}` : "", wine.abv ? `${wine.abv}% ABV` : ""].filter(Boolean);

  return (
    `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist wine: ${wine.name}. ` +
    `${details.length ? details.join(", ") : "Fine wine"}. ` +
    `PERFECT professional pour, served in an elegant appropriate wine glass. ` +
    `The liquid must look very specific to its style/color. ${HOUSE_STYLE}`
  );
}

/** How each item type is drawn, and where its sketches are stored. */
export const ITEM_IMAGE_KINDS: Record<ImageItemType, { folder: string; buildPrompt: (item: ItemForPrompt) => string }> = {
  cocktail: { folder: "cocktails", buildPrompt: cocktailPrompt },
  ingredient: { folder: "ingredients", buildPrompt: ingredientPrompt },
  beer: { folder: "beers", buildPrompt: beerPrompt },
  wine: { folder: "wines", buildPrompt: winePrompt },
};

export function isImageItemType(type: string): type is ImageItemType {
  return type in ITEM_IMAGE_KINDS;
}
