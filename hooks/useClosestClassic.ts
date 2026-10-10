import { useQuery } from '@tanstack/react-query';

import { closestClassic, type SpecIngredient } from '@/lib/closestClassic';
import { supabase } from '@/lib/supabase';

/** How many catalog drinks sharing the most ingredients are compared in full. */
const CANDIDATES = 30;

type Touch = { id: string; name: string; recipes: { ingredient_item_id: string }[] };
type Spec = { id: string; name: string; recipes: { ingredient_item_id: string; ingredient: { generic_id: string | null } | null }[] };

/**
 * The catalog classic a spec is closest to (lib/closestClassic), from its
 * ingredients (ids and generics). Two small reads of the catalog (a few
 * hundred drinks): those using any of them, then the full specs of the ones
 * sharing at least two.
 * ponytail: a brand line only finds classics through its generic's own
 * row (a classic that names "Agave Spirit"); one naming "Mezcal" still
 * counts once found through the spec's other lines. A server-side score is
 * the upgrade if that misses real matches.
 */
export function useClosestClassic(ingredients: readonly SpecIngredient[]) {
  const mine = [...new Map(ingredients.map((i) => [i.id, { id: i.id, generic: i.generic ?? null }])).values()].sort((a, b) => a.id.localeCompare(b.id));
  return useQuery({
    queryKey: ['closest-classic', mine],
    enabled: mine.length >= 2,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<{ id: string; name: string } | null> => {
      const ids = [...new Set(mine.flatMap((i) => (i.generic ? [i.id, i.generic] : [i.id])))];
      const touch = await supabase
        .from('items')
        .select('id, name, recipes:app_recipe_presentation!recipe_item_id!inner(ingredient_item_id)')
        .eq('is_catalog', true)
        .eq('item_type', 'cocktail')
        .in('recipes.ingredient_item_id', ids);
      if (touch.error) throw touch.error;
      // How many of mine each drink uses (a line, or its generic's own row, counts once).
      const shared = (d: Touch) => new Set(d.recipes.map((r) => mine.find((m) => m.id === r.ingredient_item_id || m.generic === r.ingredient_item_id)?.id).filter(Boolean)).size;
      const candidates = ((touch.data ?? []) as unknown as Touch[])
        .map((d) => ({ id: d.id, n: shared(d) }))
        .filter((d) => d.n >= 2)
        .sort((a, b) => b.n - a.n)
        .slice(0, CANDIDATES)
        .map((d) => d.id);
      if (!candidates.length) return null;

      const specs = await supabase
        .from('items')
        .select('id, name, recipes:app_recipe_presentation!recipe_item_id(ingredient_item_id, ingredient:display_ingredient(generic_id))')
        .in('id', candidates);
      if (specs.error) throw specs.error;
      const best = closestClassic(
        mine,
        ((specs.data ?? []) as unknown as Spec[]).map((s) => ({ id: s.id, name: s.name, ingredients: s.recipes.map((r) => ({ id: r.ingredient_item_id, generic: r.ingredient?.generic_id ?? null })) }))
      );
      return best ? { id: best.id, name: best.name } : null;
    },
  });
}
