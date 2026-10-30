import type { SortableRecipeItem } from '@/lib/recipeItem';
import type { DatabaseItem } from '@/types/types';

/** What the drink editors hold that the drink page reads (useCocktailEditor, useCocktailDraftEditor). */
export interface EditedDrink {
  name: string;
  description: string;
  origin: string;
  notes: string;
  glasswareId: string | null;
  familyId: string | null;
  iceId: string | null;
  /** A saved drink's editor only: the ice it's made with, and how the ice sits. */
  methodIceId?: string | null;
  iceBuild?: unknown;
  methodIds: string[];
  recipeItems: SortableRecipeItem[];
}

/** The saved drink with what's being edited laid over it, for the desktop editor's phone preview (dec-23). */
export function previewItem(edit: EditedDrink, saved: DatabaseItem): DatabaseItem {
  return {
    ...saved,
    name: edit.name.trim() || saved.name,
    description: edit.description.trim() || null,
    origin: edit.origin.trim() || null,
    notes: edit.notes.trim() || null,
    glassware_id: edit.glasswareId,
    family_id: edit.familyId,
    ice_id: edit.iceId,
    ...(edit.methodIceId === undefined ? {} : { method_ice_id: edit.methodIceId, ice_build: (edit.iceBuild ?? null) as DatabaseItem['ice_build'] }),
    item_methods: edit.methodIds.map((method_item_id, sort_order) => ({ method_item_id, sort_order })) as DatabaseItem['item_methods'],
    recipes: edit.recipeItems.map((r, sort_order) => ({
      sort_order,
      amount: r.amount || null,
      unit: r.unit || null,
      preparation_notes: r.preparation_notes || null,
      is_optional: !!r.is_optional,
      display_ingredient_id: r.ingredient_id || null,
      display_ingredient: { id: r.ingredient_id, name: r.name },
    })) as unknown as DatabaseItem['recipes'],
  };
}
