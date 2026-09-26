export function sortRecipesByOrder<T extends { sort_order?: number | null; created_at?: string }>(
    recipes: T[] | null | undefined
): T[] {
    if (!recipes?.length) return [];
    return [...recipes].sort((a, b) => {
        const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        if (a.created_at && b.created_at) {
            return a.created_at.localeCompare(b.created_at);
        }
        return 0;
    });
}

/**
 * Resolve the ingredient an app_recipe_presentation row shows to the caller.
 * Select it with the display_ingredient computed relationship, which embeds
 * only the item behind display_ingredient_id (both are masked by role).
 */
export function resolvePresentationIngredient(recipe: any) {
    if (!recipe.display_ingredient_id) return null;
    return recipe.display_ingredient ?? null;
}

function firstImageUrl(ingredient: any): string | undefined {
    const imgs = ingredient?.item_images;
    if (!imgs) return undefined;
    const arr = Array.isArray(imgs) ? imgs : [imgs];
    return arr[0]?.images?.url || arr[0]?.url;
}

export function buildIngredientImageMap(
    recipes: any[] | undefined,
    extras?: { id?: string; item_images?: any; imageUrl?: string }[]
): Record<string, string> {
    const map: Record<string, string> = {};
    recipes?.forEach((recipe) => {
        const resolved = recipe.ingredient || resolvePresentationIngredient(recipe);
        // Edit rows key by ingredient_id; keep that in the chain so thumbs aren't blank grey squircles.
        const id =
            resolved?.id ||
            recipe.display_ingredient_id ||
            recipe.ingredient_item_id ||
            recipe.ingredient_id;
        if (!id) return;
        const url = firstImageUrl(resolved);
        if (url) map[id] = url;
    });
    extras?.forEach((ing) => {
        if (!ing?.id || map[ing.id]) return;
        const url = firstImageUrl(ing) || ing.imageUrl;
        if (url) map[ing.id] = url;
    });
    return map;
}

/**
 * Map a recipe row to an editor line. Editors load raw rows (fetchEditableRecipes),
 * so saving never writes back values the presentation view masked.
 */
export function mapPresentationRecipeToEditItem(
    recipe: any,
    options?: { includeCocktailFields?: boolean }
) {
    const ingredient = recipe.ingredient || resolvePresentationIngredient(recipe);
    const item = {
        id: recipe.id,
        ingredient_id:
            recipe.ingredient_item_id ||
            ingredient?.id ||
            recipe.display_ingredient_id,
        name: ingredient?.name || 'Unknown',
        amount: recipe.amount?.toString() || '',
        unit: recipe.unit || '',
    };

    if (options?.includeCocktailFields) {
        return {
            ...item,
            preparation_notes: recipe.preparation_notes || '',
            is_optional: recipe.is_optional || false,
        };
    }

    return item;
}
