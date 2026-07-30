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

/** Resolve the ingredient join row from an app_recipe_presentation payload. */
export function resolvePresentationIngredient(recipe: any) {
    const fromDisplay = !recipe.display_ingredient_id
        ? null
        : recipe.display_ingredient_id === recipe.parent_ingredient_id
          ? recipe.generic_ingredient
          : recipe.specific_ingredient;
    // ponytail: display_ingredient_id can be null when role-masked; joins still carry the row
    const ingredient = fromDisplay || recipe.specific_ingredient || recipe.generic_ingredient;
    if (!ingredient) return null;
    return {
        ...ingredient,
        id: ingredient.id || recipe.display_ingredient_id || recipe.ingredient_item_id,
    };
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
        const id =
            recipe.ingredient?.id ||
            recipe.ingredient_item_id ||
            recipe.display_ingredient_id ||
            recipe.ingredient_id;
        const url =
            firstImageUrl(recipe.ingredient) ||
            firstImageUrl(recipe.specific_ingredient) ||
            firstImageUrl(recipe.generic_ingredient);
        if (id && url) map[id] = url;
    });
    extras?.forEach((ing) => {
        if (!ing?.id || map[ing.id]) return;
        const url = firstImageUrl(ing) || ing.imageUrl;
        if (url) map[ing.id] = url;
    });
    return map;
}

export function mapPresentationRecipeToEditItem(
    recipe: any,
    options?: { includeCocktailFields?: boolean }
) {
    const ingredient = recipe.ingredient || resolvePresentationIngredient(recipe);
    const item = {
        id: recipe.id,
        ingredient_id:
            ingredient?.id ||
            recipe.display_ingredient_id ||
            recipe.ingredient_item_id,
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
