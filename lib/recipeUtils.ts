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
    // Role-masked rows null display_ingredient_id; joins still carry brand — do not fall back.
    if (!recipe.display_ingredient_id) return null;
    const preferGeneric = recipe.display_ingredient_id === recipe.parent_ingredient_id;
    const ingredient = preferGeneric ? recipe.generic_ingredient : recipe.specific_ingredient;
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
        const resolved = recipe.ingredient || resolvePresentationIngredient(recipe);
        // Edit rows key by ingredient_id; keep that in the chain so thumbs aren't blank grey squircles.
        const id =
            resolved?.id ||
            recipe.display_ingredient_id ||
            recipe.ingredient_item_id ||
            recipe.ingredient_id;
        if (!id) return;
        // ponytail: names stay masked via resolve*; images still use joins so photos don't go blank
        const url =
            firstImageUrl(resolved) ||
            firstImageUrl(recipe.specific_ingredient) ||
            firstImageUrl(recipe.generic_ingredient);
        if (url) map[id] = url;
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
