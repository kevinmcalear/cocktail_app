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

export function mapPresentationRecipeToEditItem(
    recipe: any,
    options?: { includeCocktailFields?: boolean }
) {
    const item = {
        id: recipe.id,
        ingredient_id:
            recipe.ingredient?.id ||
            recipe.display_ingredient_id ||
            recipe.ingredient_item_id,
        name: recipe.ingredient?.name || 'Unknown',
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
