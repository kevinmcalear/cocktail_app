import assert from "node:assert/strict";

import { mapPresentationRecipeToEditItem, resolvePresentationIngredient } from "./recipeUtils";

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


const edit = mapPresentationRecipeToEditItem(rawRow, { includeCocktailFields: true });
assert.equal(edit.ingredient_id, "ing-5");
assert.equal(edit.amount, "2");
assert.equal((edit as any).preparation_notes, "shake hard");

console.log("recipeUtils.selfcheck: ok");
