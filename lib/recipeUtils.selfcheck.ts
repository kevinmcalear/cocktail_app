import assert from "node:assert/strict";

import { buildIngredientImageMap, mapPresentationRecipeToEditItem, resolvePresentationIngredient } from "./recipeUtils";

// app_recipe_presentation rows as selected with display_ingredient(...).
const specific = {
    display_ingredient_id: "ing-1",
    display_ingredient: {
        id: "ing-1",
        name: "Bourbon",
        item_images: [{ images: { url: "https://example.com/bourbon.png" } }],
    },
};

const masked = {
    display_ingredient_id: null,
    display_ingredient: null,
};

const genericOnly = {
    display_ingredient_id: "gen-1",
    display_ingredient: { id: "gen-1", name: "Gin" },
};

const editLine = {
    ingredient_id: "ing-4",
    name: "Lime",
};

// A raw recipes row as editors load it; the ingredient item itself is hidden from them.
const rawRow = {
    id: "row-1",
    ingredient_item_id: "ing-5",
    ingredient: null,
    amount: 2,
    unit: "oz",
    preparation_notes: "shake hard",
    is_optional: false,
};

assert.equal(resolvePresentationIngredient(specific)?.id, "ing-1");
assert.equal(resolvePresentationIngredient(masked), null);
assert.equal(resolvePresentationIngredient(genericOnly)?.name, "Gin");

const map = buildIngredientImageMap(
    [
        { ...specific, ingredient: resolvePresentationIngredient(specific) },
        { ...masked, ingredient: resolvePresentationIngredient(masked) },
        { ...genericOnly, ingredient: resolvePresentationIngredient(genericOnly) },
        editLine,
    ],
    [{ id: "ing-4", item_images: [{ images: { url: "https://example.com/lime.png" } }] }]
);

assert.equal(map["ing-1"], "https://example.com/bourbon.png");
// A generic ingredient with no photo of its own gets none (never the brand's).
assert.equal(map["gen-1"], undefined);
assert.equal(map["ing-4"], "https://example.com/lime.png");
assert.equal(Object.keys(map).length, 2);

const edit = mapPresentationRecipeToEditItem(rawRow, { includeCocktailFields: true });
assert.equal(edit.ingredient_id, "ing-5");
assert.equal(edit.amount, "2");
assert.equal((edit as any).preparation_notes, "shake hard");

console.log("recipeUtils.selfcheck: ok");
