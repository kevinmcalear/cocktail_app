import { HOUSE_STYLE, ingredientNames, serveItemImageGenerator } from "../_shared/itemImage.ts";

serveItemImageGenerator({
  name: "generate-cocktail-image",
  idField: "cocktail_id",
  itemType: "cocktail",
  folder: "cocktails",
  buildPrompt: (cocktail) => {
    const glass = cocktail.glassware?.name ?? "glass";
    const methods = [...cocktail.item_methods]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((m) => m.method?.name)
      .filter(Boolean)
      .join(" and ");
    const ingredients = ingredientNames(cocktail);

    const details = [
      `${cocktail.name} cocktail inside a ${glass}.`,
      `${methods || "Prepared"} liquid.`,
      cocktail.ice ? `${cocktail.ice.name} ice.` : "",
      ingredients.length ? `Contains: ${ingredients.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      `A very rough, sketchy, unfinished hand-drawn pencil illustration of a high-end minimalist ${cocktail.name} cocktail. ` +
      `${details} PERFECT professional wash line, filled just a finger-width below the rim. ` +
      `The liquid must look very clean, light, and refreshing. ${HOUSE_STYLE}`
    );
  },
});
