import { useQuery } from '@tanstack/react-query';

import type { HouseMade, Purchasing, SpecLine } from '@/lib/prep';
import { supabase } from '@/lib/supabase';

interface RecipeRow {
  recipe_item_id: string;
  amount: number | null;
  unit: string | null;
  display_ingredient_id: string | null;
  display_ingredient: { id: string; name: string } | null;
}

export interface PrepData {
  drinks: { id: string; name: string; recipe: SpecLine[] }[];
  houseMade: Record<string, HouseMade>;
  purchasing: Record<string, Purchasing>;
}

const MAX_LEVELS = 3;

function toLines(rows: RecipeRow[], recipeId: string): SpecLine[] {
  return rows
    .filter((r) => r.recipe_item_id === recipeId && r.display_ingredient_id && r.display_ingredient)
    .map((r) => ({ ingredientId: r.display_ingredient!.id, name: r.display_ingredient!.name, amount: r.amount, unit: r.unit }));
}

async function recipesFor(ids: string[]): Promise<RecipeRow[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('app_recipe_presentation')
    .select('recipe_item_id, amount, unit, display_ingredient_id, display_ingredient(id, name)')
    .in('recipe_item_id', ids);
  if (error) throw error;
  return (data ?? []) as unknown as RecipeRow[];
}

/**
 * Everything the prep list needs for a set of menus at a venue: each drink's
 * spec, the house-made ingredients under it (their own recipes, yield and lead
 * time, a few levels deep), and how the bar buys the rest. Masked by role on
 * the server like every recipe read.
 */
export function usePrepData(barId: string | null | undefined, menuIds: string[]) {
  const key = [...menuIds].sort();
  return useQuery({
    queryKey: ['prep-data', barId, key],
    enabled: !!barId && key.length > 0,
    queryFn: async (): Promise<PrepData> => {
      const { data: menuRows, error: menuError } = await supabase
        .from('menu_drinks')
        .select('item:items!item_id(id, name, item_type)')
        .in('menu_id', key);
      if (menuError) throw menuError;
      const drinkItems = new Map<string, string>();
      for (const row of (menuRows ?? []) as unknown as { item: { id: string; name: string; item_type: string } | null }[]) {
        if (row.item?.item_type === 'cocktail') drinkItems.set(row.item.id, row.item.name);
      }
      const drinkIds = [...drinkItems.keys()];
      const drinkRecipes = await recipesFor(drinkIds);
      const drinks = drinkIds.map((id) => ({ id, name: drinkItems.get(id)!, recipe: toLines(drinkRecipes, id) }));

      // Walk down: any ingredient with its own recipe or prep row is house-made.
      const houseMade: Record<string, HouseMade> = {};
      const seen = new Set<string>(drinkIds);
      let frontier = [...new Set(drinks.flatMap((d) => d.recipe.map((l) => l.ingredientId)))];
      const leaves = new Set<string>();
      for (let level = 0; level < MAX_LEVELS && frontier.length; level++) {
        const ids = frontier.filter((id) => !seen.has(id));
        ids.forEach((id) => seen.add(id));
        const [subRecipes, prepRes] = await Promise.all([
          recipesFor(ids),
          supabase.from('item_prep').select('item_id, yield_amount, yield_unit, lead_time_minutes, lead_time_note').in('item_id', ids),
        ]);
        if (prepRes.error) throw prepRes.error;
        const prepById = new Map((prepRes.data ?? []).map((p) => [p.item_id as string, p]));
        const next: string[] = [];
        for (const id of ids) {
          const recipe = toLines(subRecipes, id);
          const prep = prepById.get(id);
          if (!recipe.length && !prep) {
            leaves.add(id);
            continue;
          }
          houseMade[id] = {
            recipe,
            yieldAmount: prep?.yield_amount ?? null,
            yieldUnit: prep?.yield_unit ?? null,
            leadTimeMinutes: prep?.lead_time_minutes ?? null,
            leadTimeNote: prep?.lead_time_note ?? null,
          };
          next.push(...recipe.map((l) => l.ingredientId));
        }
        frontier = next;
      }
      frontier.forEach((id) => !houseMade[id] && leaves.add(id));

      const purchasing: Record<string, Purchasing> = {};
      const leafIds = [...leaves];
      if (leafIds.length) {
        const [buyRes, supplierRes] = await Promise.all([
          supabase.from('item_purchasing').select('item_id, supplier_id, pack_size_amount, pack_size_unit').eq('bar_id', barId!).in('item_id', leafIds),
          supabase.from('suppliers').select('id, name').eq('bar_id', barId!),
        ]);
        // ponytail: without the prep or costs capability these reads come back
        // empty (RLS), and the order list just has no packs or suppliers.
        const suppliers = new Map((supplierRes.data ?? []).map((s) => [s.id as string, s.name as string]));
        for (const row of buyRes.data ?? []) {
          purchasing[row.item_id as string] = {
            supplierName: row.supplier_id ? (suppliers.get(row.supplier_id as string) ?? null) : null,
            packAmount: row.pack_size_amount as number | null,
            packUnit: row.pack_size_unit as string | null,
          };
        }
      }
      return { drinks, houseMade, purchasing };
    },
  });
}
