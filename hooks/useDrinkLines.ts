import { useQuery } from '@tanstack/react-query';

import { chunk } from '@/lib/commandSearchGrid';
import { readingName } from '@/lib/menus';
import { supabase } from '@/lib/supabase';

/** A drink's ingredients in spec order (as named) and its method, for a row's line and home's style chips. Plain JSON. */
export interface DrinkLine {
  ingredients: string[];
  /** As a line reads them: plain ones in lower case, bottles as named. */
  reading: string[];
  method: string | null;
}

type Line = { recipe_item_id: string; is_optional: boolean | null; display_ingredient: { name: string; ingredient_role: string | null } | null };
type Method = { item_id: string; method: { name: string } | null };

/**
 * Home Drinks' rows (Prod-phone drinks, home): each drink's ingredients and
 * method, read through the presentation views like every recipe, so a
 * masked spec gives nothing away. Optional lines are left out.
 */
export function useDrinkLines(ids: readonly string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['drink-lines', key],
    enabled: key.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Record<string, DrinkLine>> => {
      const out: Record<string, DrinkLine> = Object.fromEntries(key.map((id) => [id, { ingredients: [], reading: [], method: null }]));
      await Promise.all(
        chunk(key, 150).map(async (batch) => {
          const [lines, methods] = await Promise.all([
            supabase.from('app_recipe_presentation').select('recipe_item_id, is_optional, sort_order, display_ingredient(name, ingredient_role)').in('recipe_item_id', batch).order('sort_order'),
            supabase.from('item_methods').select('item_id, method:method_item_id(name)').in('item_id', batch).order('sort_order'),
          ]);
          if (lines.error) throw lines.error;
          if (methods.error) throw methods.error;
          for (const l of (lines.data ?? []) as unknown as Line[]) {
            const ing = l.display_ingredient;
            const row = out[l.recipe_item_id];
            if (!ing || l.is_optional || !row || row.ingredients.includes(ing.name)) continue;
            row.ingredients.push(ing.name);
            row.reading.push(readingName(ing)!);
          }
          for (const m of (methods.data ?? []) as unknown as Method[]) {
            const row = out[m.item_id];
            if (row && !row.method && m.method?.name) row.method = m.method.name;
          }
        })
      );
      return out;
    },
  });
}
