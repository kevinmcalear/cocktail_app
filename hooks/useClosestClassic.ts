import { useQuery } from '@tanstack/react-query';

import { closestClassic, type ClassicSpec, type SpecIngredient } from '@/lib/closestClassic';
import { supabase } from '@/lib/supabase';

/** How many catalog drinks sharing the most ingredients are compared in full. */
const CANDIDATES = 30;

type UseRow = { recipe_item_id: string; ingredient_item_id: string; drink: { name: string } | null; ingredient?: { generic_id: string | null } | null };
type LineRow = { recipe_item_id: string; ingredient_item_id: string; ingredient: { generic_id: string | null } | null };

/**
 * The catalog classic a spec is closest to (lib/closestClassic), from its
 * ingredients (ids and generics). Two small reads: the catalog drinks using
 * any of them, then the full specs of those sharing the most.
 * ponytail: the first read stops at 1,000 recipe lines (PostgREST's cap);
 * a spec of common bottles (lime, sugar) may miss a few candidates. An RPC
 * that scores in SQL is the upgrade if that ever matters.
 */
export function useClosestClassic(ingredients: readonly SpecIngredient[]) {
  const mine = [...new Map(ingredients.map((i) => [i.id, { id: i.id, generic: i.generic ?? null }])).values()].sort((a, b) => a.id.localeCompare(b.id));
  return useQuery({
    queryKey: ['closest-classic', mine],
    enabled: mine.length >= 2,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<{ id: string; name: string } | null> => {
      const ids = mine.map((i) => i.id);
      const generics = [...new Set(mine.flatMap((i) => (i.generic ? [i.generic] : [])))];
      // Catalog drinks using any of the same bottles, and any of the same kind of bottle.
      const catalog = (select: string) => supabase.from('recipes').select(select).eq('drink.is_catalog', true).eq('drink.item_type', 'cocktail').limit(1000);
      const [same, kind] = await Promise.all([
        catalog('recipe_item_id, ingredient_item_id, drink:items!new_recipes_recipe_item_id_fkey!inner(name)').in('ingredient_item_id', ids),
        generics.length
          ? catalog('recipe_item_id, ingredient_item_id, drink:items!new_recipes_recipe_item_id_fkey!inner(name), ingredient:items!new_recipes_ingredient_item_id_fkey!inner(generic_id)').in('ingredient.generic_id', generics)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (same.error) throw same.error;
      if (kind.error) throw kind.error;
      const rows = [...((same.data ?? []) as unknown as UseRow[]), ...((kind.data ?? []) as unknown as UseRow[])];
      // Which of mine each drink touches, by id or by generic.
      const touched = new Map<string, Set<string>>();
      for (const r of rows) {
        const hit = mine.find((m) => m.id === r.ingredient_item_id || (!!m.generic && m.generic === r.ingredient?.generic_id));
        if (!hit) continue;
        touched.set(r.recipe_item_id, (touched.get(r.recipe_item_id) ?? new Set()).add(hit.id));
      }
      const candidates = [...touched].filter(([, t]) => t.size >= 2).sort((a, b) => b[1].size - a[1].size).slice(0, CANDIDATES).map(([id]) => id);
      if (!candidates.length) return null;
      const names = new Map(rows.map((r) => [r.recipe_item_id, r.drink?.name ?? '']));

      const lines = await supabase
        .from('recipes')
        .select('recipe_item_id, ingredient_item_id, ingredient:items!new_recipes_ingredient_item_id_fkey(generic_id)')
        .in('recipe_item_id', candidates);
      if (lines.error) throw lines.error;
      const specs = new Map<string, ClassicSpec & { ingredients: SpecIngredient[] }>();
      for (const l of (lines.data ?? []) as unknown as LineRow[]) {
        const spec = specs.get(l.recipe_item_id) ?? { id: l.recipe_item_id, name: names.get(l.recipe_item_id) ?? '', ingredients: [] };
        spec.ingredients.push({ id: l.ingredient_item_id, generic: l.ingredient?.generic_id ?? null });
        specs.set(spec.id, spec);
      }
      const best = closestClassic(mine, [...specs.values()]);
      return best ? { id: best.id, name: best.name } : null;
    },
  });
}
