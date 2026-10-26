import { useQuery } from '@tanstack/react-query';

import { closeClassics, closestClassic, type SpecIngredient } from '@/lib/closestClassic';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { readingName } from '@/lib/menus';
import { supabase } from '@/lib/supabase';

/** How many catalog drinks sharing the most ingredients are compared in full. */
const CANDIDATES = 30;

type Touch = { id: string; name: string; recipes: { ingredient_item_id: string }[] };
type Spec = {
  id: string;
  name: string;
  glass: { icon_key: string | null } | null;
  item_images: ItemImageLink[] | null;
  recipes: { ingredient_item_id: string; ingredient: { generic_id: string | null; name: string; ingredient_role: string | null } | null }[];
};

/** A riff card (board w2-wizard-steps, Q25): the classic, its picture or glass, and what it shares ("mezcal, lime, agave"). Plain JSON. */
export interface CloseClassic {
  id: string;
  name: string;
  imageUrl: string | null;
  glass: string | null;
  shares: string[];
}

interface Close {
  best: { id: string; name: string } | null;
  cards: CloseClassic[];
}

/**
 * The catalog classic a spec is closest to (lib/closestClassic), from its
 * ingredients (ids and generics). Two small reads of the catalog (a few
 * hundred drinks): those using any of them, then the full specs of the ones
 * sharing the most.
 * ponytail: a brand line only finds classics through its generic's own
 * row (a classic that names "Agave Spirit"); one naming "Mezcal" still
 * counts once found through the spec's other lines. A server-side score is
 * the upgrade if that misses real matches.
 */
export function useClosestClassic(ingredients: readonly SpecIngredient[]) {
  return useClose(ingredients, (c) => c.best);
}

/** Up to four classics sharing the most with the spec, for the riff cards. The same read as useClosestClassic. */
export function useCloseClassics(ingredients: readonly SpecIngredient[]) {
  return useClose(ingredients, (c) => c.cards);
}

function useClose<T>(ingredients: readonly SpecIngredient[], select: (c: Close) => T) {
  const mine = [...new Map(ingredients.map((i) => [i.id, { id: i.id, generic: i.generic ?? null }])).values()].sort((a, b) => a.id.localeCompare(b.id));
  return useQuery({
    queryKey: ['close-classics', mine],
    enabled: mine.length >= 2,
    staleTime: 10 * 60 * 1000,
    select,
    queryFn: async (): Promise<Close> => {
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
        .sort((a, b) => b.n - a.n)
        .slice(0, CANDIDATES)
        .map((d) => d.id);
      if (!candidates.length) return { best: null, cards: [] };

      const specs = await supabase
        .from('items')
        .select(
          'id, name, glass:glassware_id(icon_key), item_images(angle, sort_order, is_generated, images(url)), recipes:app_recipe_presentation!recipe_item_id(ingredient_item_id, ingredient:display_ingredient(generic_id, name, ingredient_role))'
        )
        .in('id', candidates);
      if (specs.error) throw specs.error;
      const rows = ((specs.data ?? []) as unknown as Spec[]).map((s) => ({
        ...s,
        ingredients: s.recipes.map((r) => ({ id: r.ingredient_item_id, generic: r.ingredient?.generic_id ?? null, name: readingName(r.ingredient) })),
      }));
      const best = closestClassic(mine, rows);
      return {
        best: best ? { id: best.id, name: best.name } : null,
        cards: closeClassics(mine, rows).map(({ spec, lines }) => ({
          id: spec.id,
          name: spec.name,
          imageUrl: heroPicture(spec.item_images)?.url ?? null,
          glass: spec.glass?.icon_key ?? null,
          shares: [...new Set(lines.flatMap((l) => (l.name ? [l.name] : [])))],
        })),
      };
    },
  });
}
