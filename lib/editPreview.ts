import { perDrinkLines } from '@/lib/batchLines';
import { linePart, storedParts, type DraftPart } from '@/lib/drinkParts';
import { notesArePrivate, type WizardDraft } from '@/lib/drinkWizard';
import type { SortableRecipeItem } from '@/lib/recipeItem';
import type { DatabaseItem } from '@/types/types';

/** What the drink page reads of an ingredient: its ABV and density (strength, ml), and whether it's house-made. */
type Ingredient = { id?: string; name?: string | null; abv?: number | null; density_g_ml?: number | null; ingredient_role?: string | null };
type Named = { id: string | null; name: string };

/** What the drink editors hold that the drink page reads (useCocktailEditor, useCocktailDraftEditor). */
export interface EditedDrink {
  name: string;
  description: string;
  origin: string;
  notes: string;
  glasswareId: string | null;
  familyId: string | null;
  iceId: string | null;
  /** A saved drink's editor only: the ice it's made with, how the ice sits, the real glass, and its parts. */
  methodIceId?: string | null;
  iceBuild?: unknown;
  glassModel?: unknown;
  parts?: DraftPart[] | null;
  methodIds: string[];
  recipeItems: SortableRecipeItem[];
  /** The method and ingredient lists, for names and what's known of a line added while editing. */
  methods?: readonly unknown[];
  allIngredients?: readonly unknown[];
}

type Line = { key?: string; id: string | null; name: string; amount: string; unit: string; note?: string; optional?: boolean; house?: boolean; garnish?: boolean };

/** Spec lines as the drink page reads them (app_recipe_presentation): by the name typed, with what's known of the ingredient and its part. */
function recipesOf(lines: Line[], parts: readonly DraftPart[] | null | undefined, known: (id: string | null) => Ingredient | undefined) {
  return lines.map((l, sort_order) => {
    // A line typed as a new name has no id yet: a stand-in one, or the page reads it as hidden (resolvePresentationIngredient).
    const id = l.id || `new-${sort_order}`;
    const ingredient: Ingredient = { ...known(l.id), id, name: l.name, ...(l.house ? { ingredient_role: 'prep' } : {}) };
    return {
      sort_order,
      amount: l.amount || null,
      unit: l.unit || null,
      preparation_notes: l.note || null,
      is_optional: !!l.optional,
      part: parts?.length ? linePart(parts, l.key ?? '', !!l.garnish) : null,
      display_ingredient_id: id,
      display_ingredient: ingredient,
      ingredient,
    };
  }) as unknown as DatabaseItem['recipes'];
}

/** The methods in order, by part when it's made in parts, each with its name (DrinkParts reads it). */
function methodsOf(methods: Named[], parts: readonly DraftPart[] | null | undefined) {
  const rows = parts?.length ? parts.flatMap((p, i) => p.methods.map((m) => ({ m, part: i + 1 }))) : methods.map((m) => ({ m, part: 1 }));
  return rows.flatMap(({ m, part }, sort_order) => (m.id ? [{ method_item_id: m.id, sort_order, part, method: { name: m.name } }] : [])) as unknown as DatabaseItem['item_methods'];
}

const byId = (list: readonly unknown[] | undefined) => (id: string | null) => (id ? (list as Ingredient[] | undefined)?.find((x) => x.id === id) : undefined);

/** The saved drink with what's being edited laid over it, for the desktop editor's phone preview (dec-23). */
export function previewItem(edit: EditedDrink, saved: DatabaseItem): DatabaseItem {
  const savedIngredient = (id: string | null) => (saved.recipes as unknown as { display_ingredient?: Ingredient | null }[] | undefined)?.find((r) => id && r.display_ingredient?.id === id)?.display_ingredient ?? undefined;
  const catalog = byId(edit.allIngredients);
  const methodName = byId(edit.methods);
  const parts = edit.parts ?? null;
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
    // The glass as edited, so the page doesn't read the saved one (useDrinkGlass).
    ...('glassModel' in edit ? { glass_model: edit.glassModel ?? null } : {}),
    madeInParts: parts?.length ? storedParts(parts) : null,
    item_methods: methodsOf(edit.methodIds.map((id) => ({ id, name: methodName(id)?.name ?? '' })), parts),
    recipes: recipesOf(
      edit.recipeItems.map((r, i) => ({ key: r.key ?? r.id ?? `${r.ingredient_id}-${i}`, id: r.ingredient_id || null, name: r.name, amount: r.amount, unit: r.unit, note: r.preparation_notes, optional: r.is_optional, house: !!(r.prep || r.later || r.batch) })),
      parts,
      (id) => savedIngredient(id) ?? catalog(id)
    ),
  } as DatabaseItem;
}

/**
 * A drink being added, as its page will read it once saved: for desktop's
 * phone preview while it's written. A batch line reads as the drink's own
 * pours, the finish after the spec, and notes kept to yourself stay off it.
 * Picks typed as new names (no id yet) aren't on it until saved.
 */
export function draftPreviewItem(draft: WizardDraft, barId: string | null, ingredients?: readonly unknown[]): DatabaseItem {
  const parts = draft.parts ?? null;
  const lines: Line[] = [
    ...perDrinkLines(draft.lines).map((l) => ({ ...l, house: !!(l.prep || l.later || l.batch) })),
    ...draft.garnishes.map((l) => ({ ...l, house: !!(l.prep || l.later), garnish: true })),
  ];
  return {
    id: draft.id ?? 'new-drink',
    item_type: 'cocktail',
    bar_id: barId,
    name: draft.name.trim() || 'New drink',
    description: draft.description.trim() || null,
    origin: null,
    notes: notesArePrivate(draft, barId) ? null : draft.notes.trim() || null,
    glassware_id: draft.glass?.id ?? null,
    glass_model: null,
    ice_id: draft.ice?.id ?? null,
    method_ice_id: draft.methodIce?.id ?? null,
    family_id: null,
    ice_build: null,
    show_sketch: true,
    madeInParts: parts?.length ? storedParts(parts) : null,
    item_methods: methodsOf(draft.methods, parts),
    recipes: recipesOf(lines, parts, byId(ingredients)),
  } as unknown as DatabaseItem;
}
