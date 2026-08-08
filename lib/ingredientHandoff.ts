/** Handoff from nested "create ingredient" back to the recipe that opened it. */
export type IngredientHandoff = {
  id: string;
  name: string;
  /** Draft id this published id replaces (avoid draft+published duplicates). */
  replacedId?: string | null;
  /** Only this parent recipe editor should attach the ingredient. */
  targetId?: string | null;
};

type RecipeLine = { ingredient_id: string; name: string };

/**
 * Apply a create-ingredient handoff to a parent recipe list.
 * Returns null when this editor should ignore the event (wrong target / self).
 */
export function applyIngredientHandoff<T extends RecipeLine>(
  prev: T[],
  handoff: IngredientHandoff,
  selfId?: string | null,
  defaults?: Partial<T>
): T[] | null {
  if (handoff.targetId && selfId && handoff.targetId !== selfId) return null;
  // Never attach an ingredient to its own recipe
  if (selfId && (handoff.id === selfId || handoff.replacedId === selfId)) return null;

  if (handoff.replacedId) {
    const idx = prev.findIndex((i) => i.ingredient_id === handoff.replacedId);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = { ...next[idx], ingredient_id: handoff.id, name: handoff.name };
      return next;
    }
  }

  if (prev.some((i) => i.ingredient_id === handoff.id)) return prev;

  return [
    ...prev,
    {
      ...(defaults as T),
      ingredient_id: handoff.id,
      name: handoff.name,
    },
  ];
}

/** Drop any recipe line that points at the ingredient itself. */
export function withoutSelfRecipeRefs<T extends RecipeLine>(
  items: T[],
  selfId?: string | null
): T[] {
  if (!selfId) return items;
  return items.filter((i) => i.ingredient_id !== selfId);
}
