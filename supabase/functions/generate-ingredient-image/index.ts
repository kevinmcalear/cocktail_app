import { ingredientNames, serveItemImageGenerator } from "../_shared/itemImage.ts";

serveItemImageGenerator({
  name: "generate-ingredient-image",
  idField: "ingredient_id",
  itemType: "ingredient",
  folder: "ingredients",
  buildPrompt: (ingredient) => {
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
      "for a slight hint of color—not fully colored in. The background MUST be a perfectly clean, uniform, flat light " +
      "paper texture with absolutely no sketchbook edges, no binder rings, and no borders. NO TEXT ANYWHERE. No words. " +
      "Extremely sophisticated, elegant, but intentionally rough and sketchy."
    );
  },
});
