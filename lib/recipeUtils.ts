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
