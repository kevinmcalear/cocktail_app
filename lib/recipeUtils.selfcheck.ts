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

assert.equal(resolvePresentationIngredient(withNested)?.id, "ing-1");
assert.equal(resolvePresentationIngredient(masked)?.id, "ing-2");

const map = buildIngredientImageMap(
    [
        { ...withNested, ingredient: resolvePresentationIngredient(withNested) },
        { ...masked, ingredient: resolvePresentationIngredient(masked) },
    ],
    [{ id: "ing-3", item_images: [{ images: { url: "https://example.com/extra.png" } }] }]
);

assert.equal(map["ing-1"], "https://example.com/bourbon.png");
assert.equal(map["ing-2"], "https://example.com/gin.png");
assert.equal(map["ing-3"], "https://example.com/extra.png");

console.log("recipeUtils.selfcheck: ok");
