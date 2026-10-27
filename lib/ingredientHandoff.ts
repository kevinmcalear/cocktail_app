type RecipeLine = { ingredient_id: string; name: string };

/** Drop any recipe line that points at the ingredient itself. */
export function withoutSelfRecipeRefs<T extends RecipeLine>(
  items: T[],
  selfId?: string | null
): T[] {
  if (!selfId) return items;
  return items.filter((i) => i.ingredient_id !== selfId);
}
