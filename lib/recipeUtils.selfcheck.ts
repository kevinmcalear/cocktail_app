import assert from "node:assert/strict";

import { buildIngredientImageMap, resolvePresentationIngredient } from "./recipeUtils";

const withNested = {
    display_ingredient_id: "ing-1",
    ingredient_item_id: "ing-1",
    parent_ingredient_id: null,
    specific_ingredient: {
        id: "ing-1",
        name: "Bourbon",
        item_images: [{ images: { url: "https://example.com/bourbon.png" } }],
    },
    generic_ingredient: null,
};

const masked = {
    display_ingredient_id: null,
    ingredient_item_id: "ing-2",
    parent_ingredient_id: null,
    specific_ingredient: {
        id: "ing-2",
        name: "Gin",
        item_images: [{ images: { url: "https://example.com/gin.png" } }],
    },
    generic_ingredient: null,
};

const genericOnly = {
    display_ingredient_id: "gen-1",
    ingredient_item_id: "ing-3",
    parent_ingredient_id: "gen-1",
    specific_ingredient: {
        id: "ing-3",
        name: "Tanqueray",
        item_images: [{ images: { url: "https://example.com/tanqueray.png" } }],
    },
    generic_ingredient: { id: "gen-1", name: "Gin" },
};

const editLine = {
    ingredient_id: "ing-4",
    name: "Lime",
};

assert.equal(resolvePresentationIngredient(withNested)?.id, "ing-1");
assert.equal(resolvePresentationIngredient(masked), null);
assert.equal(resolvePresentationIngredient(genericOnly)?.name, "Gin");

const map = buildIngredientImageMap(
    [
        { ...withNested, ingredient: resolvePresentationIngredient(withNested) },
        { ...masked, ingredient: resolvePresentationIngredient(masked) },
        { ...genericOnly, ingredient: resolvePresentationIngredient(genericOnly) },
        editLine,
    ],
    [{ id: "ing-4", item_images: [{ images: { url: "https://example.com/lime.png" } }] }]
);

assert.equal(map["ing-1"], "https://example.com/bourbon.png");
// Masked: no name leak via resolve*, but join image still maps for edit thumbs
assert.equal(map["ing-2"], "https://example.com/gin.png");
// Generic display with no generic photo → fall back to specific join photo
assert.equal(map["gen-1"], "https://example.com/tanqueray.png");
assert.equal(map["ing-4"], "https://example.com/lime.png");

console.log("recipeUtils.selfcheck: ok");
