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

/**
 * Every picture shows its subject and nothing else: the frame is for the drink
 * or ingredient itself, never props someone might mistake for part of it.
 */
export const ONLY_THE_SUBJECT =
  "Draw ONLY the subject described, alone and centred, and no other objects of any kind: no bar tools (spoons, " +
  "jiggers, strainers, tongs), no ice cubes, no additional glasses or bottles, no loose fruit, herbs or garnish " +
  "beyond what is described, no napkins, coasters, boards, table or bar top, no scenery and no people. At most a " +
  "faint soft shadow beneath it.";

/** Shared tail of every prompt: the house illustration style. */
export const HOUSE_STYLE =
  "The style is inspired by premium minimalist bars like Caretaker's Cottage: understated elegance. " +
  "Visible messy sketch lines, overlapping pencil strokes, with only very subtle, muted watercolor washes for a hint " +
  "of true-to-life colour. The background MUST be a perfectly clean, uniform, flat light paper texture with no marks, " +
  "smudges or washes behind the subject, no sketchbook edges, no binder rings, and no borders. NO TEXT ANYWHERE: no " +
  "words, no letters, no labels with writing. Extremely sophisticated but intentionally rough and unfinished. " +
  ONLY_THE_SUBJECT;

// Recipe units that describe something set on or in the glass rather than
// poured (see lib/units.ts), so the sketch draws them as the garnish.
const GARNISH_UNITS = new Set(["peel", "twist", "wheel", "slice", "sprig", "leaf"]);

function sortedRecipes(item: ItemForPrompt) {
  return [...item.recipes].sort((a, b) => a.sort_order - b.sort_order);
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
    `The liquid must look very clean, light, and refreshing. Only the glass, the drink and any garnish listed. ` +
    `${HOUSE_STYLE}`
  );
}

function ingredientPrompt(ingredient: ItemForPrompt): string {
  // An ingredient is drawn as the thing itself, in the form it arrives at the
  // bar. One with its own recipe is house-made, so it lives in a plain bottle.
  const houseMade = ingredient.recipes.length > 0;
  const maker = ingredient.brand_maker ? ` by ${ingredient.brand_maker}` : "";
  const form = houseMade
    ? `It is a house-made preparation, so draw it as the liquid (or mixture) in a single plain, unlabelled glass ` +
      `bottle with a simple stopper, showing its true colour.`
    : `Decide what ${ingredient.name} physically is and draw exactly that: a bottled product (a spirit, liqueur, ` +
      `vermouth, wine, sherry, champagne, beer or cider) is drawn as its own bottle, in the shape that product ` +
      `really comes in; fresh produce, herbs, spices, tea or coffee are drawn as the item itself; a pantry item or ` +
      `prepared liquid (a syrup, cordial, juice, saline, bitters) is drawn in the container it is usually kept in.`;

  return (
    `A very rough, sketchy, unfinished hand-drawn pencil illustration of one ingredient: ${ingredient.name}${maker}. ` +
    `${form} Show only that one ingredient, not a drink made from it, not served in a glass. ${HOUSE_STYLE}`
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
