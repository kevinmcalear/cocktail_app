import { useQuery } from '@tanstack/react-query';

import { closestClassic, type ClassicSpec } from '@/lib/closestClassic';
import { supabase } from '@/lib/supabase';

/** How many catalog drinks sharing the most ingredients are compared in full. */
const CANDIDATES = 30;

type UseRow = { recipe_item_id: string; drink: { name: string } | null };
type LineRow = { recipe_item_id: string; ingredient_item_id: string; ingredient: { generic_id: string | null } | null };

/**
 * The catalog classic a spec is closest to (lib/closestClassic), from its
 * ingredients' ids (generics where known). Two small reads: the catalog
 * drinks using any of them, then the full specs of those sharing the most.
 * ponytail: the first read stops at 1,000 recipe lines (PostgREST's cap);
 * a spec of common bottles (lime, sugar) may miss a few candidates. An RPC
 * that scores in SQL is the upgrade if that ever matters.
 */
export function useClosestClassic(ingredientIds: readonly string[]) {
  const ids = [...new Set(ingredientIds)].sort();
  return useQuery({
    queryKey: ['closest-classic', ids],
    enabled: ids.length >= 2,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<{ id: string; name: string } | null> => {
      const uses = await supabase
        .from('recipes')
        .select('recipe_item_id, drink:items!new_recipes_recipe_item_id_fkey!inner(name)')
        .in('ingredient_item_id', ids)
        .eq('drink.is_catalog', true)
        .eq('drink.item_type', 'cocktail')
        .limit(1000);
      if (uses.error) throw uses.error;
      const shared = new Map<string, number>();
      for (const r of (uses.data ?? []) as unknown as UseRow[]) shared.set(r.recipe_item_id, (shared.get(r.recipe_item_id) ?? 0) + 1);
      const candidates = [...shared].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, CANDIDATES).map(([id]) => id);
      if (!candidates.length) return null;
      const names = new Map(((uses.data ?? []) as unknown as UseRow[]).map((r) => [r.recipe_item_id, r.drink?.name ?? '']));

      const lines = await supabase
        .from('recipes')
        .select('recipe_item_id, ingredient_item_id, ingredient:items!new_recipes_ingredient_item_id_fkey(generic_id)')
        .in('recipe_item_id', candidates);
      if (lines.error) throw lines.error;
      const specs = new Map<string, ClassicSpec & { ingredients: string[] }>();
      for (const l of (lines.data ?? []) as unknown as LineRow[]) {
        const spec = specs.get(l.recipe_item_id) ?? { id: l.recipe_item_id, name: names.get(l.recipe_item_id) ?? '', ingredients: [] };
        spec.ingredients.push(l.ingredient?.generic_id ?? l.ingredient_item_id);
        specs.set(spec.id, spec);
      }
      const best = closestClassic(ids, [...specs.values()]);
      return best ? { id: best.id, name: best.name } : null;
    },
  });
}
