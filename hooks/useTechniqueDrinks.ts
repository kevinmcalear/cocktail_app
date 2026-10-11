import { useQuery } from '@tanstack/react-query';

import { chunk } from '@/lib/commandSearchGrid';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { supabase } from '@/lib/supabase';
import { actionFor } from '@/lib/techniques/makeIt';
import { madeWith } from '@/lib/techniques/projects';
import type { Technique } from '@/lib/techniques';

export interface TechniqueDrink {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** Rows of the read below, in URL-sized batches. */
async function inBatches<T>(ids: readonly string[], read: (batch: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const rows = await Promise.all(
    chunk([...ids], 150).map(async (batch) => {
      const { data, error } = await read(batch);
      if (error) throw error;
      return (data ?? []) as T[];
    })
  );
  return rows.flat();
}

/**
 * The drinks each technique goes into, for My Bar's project cards ("4 drinks:
 * Garibaldi, Campari Orange…"): cocktails whose spec has a catalog prep made
 * with it (lib/techniques/projects.ts madeWith), as the caller can read them,
 * A to Z. Methods (a dry shake) make no prep, so they get none.
 */
export function useTechniqueDrinks(techniques: readonly Technique[], enabled = true) {
  const made = techniques.filter((t) => !t.method);
  const actions = [...new Set(made.map(actionFor))].sort();
  return useQuery({
    queryKey: ['technique-drinks', made.map((t) => t.id).sort()],
    enabled: enabled && made.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<Record<string, TechniqueDrink[]>> => {
      const { data: cards, error } = await supabase.from('item_prep').select('item_id, actions').overlaps('actions', actions).limit(3000);
      if (error) throw error;
      const tags = new Map(((cards ?? []) as { item_id: string; actions: string[] }[]).map((c) => [c.item_id, c.actions]));
      const preps = await inBatches<{ id: string; name: string }>([...tags.keys()], (b) => supabase.from('app_item_presentation').select('id, name').in('id', b));
      const prepsFor = new Map(made.map((t) => [t.id, preps.filter((p) => madeWith(t, { name: p.name, actions: tags.get(p.id) ?? [] })).map((p) => p.id)]));
      const used = [...new Set([...prepsFor.values()].flat())];
      const lines = await inBatches<{ recipe_item_id: string; display_ingredient_id: string }>(used, (b) =>
        supabase.from('app_recipe_presentation').select('recipe_item_id, display_ingredient_id').in('display_ingredient_id', b)
      );
      const drinks = await inBatches<{ id: string; name: string; item_type: string; item_images: ItemImageLink[] | null }>([...new Set(lines.map((l) => l.recipe_item_id))], (b) =>
        supabase.from('app_item_presentation').select('id, name, item_type, item_images(angle, sort_order, is_generated, images(url))').in('id', b).eq('item_type', 'cocktail')
      );
      const byId = new Map(drinks.map((d) => [d.id, { id: d.id, name: d.name, imageUrl: heroPicture(d.item_images)?.url ?? null }]));
      return Object.fromEntries(
        made.map((t) => {
          const mine = new Set(prepsFor.get(t.id));
          const ids = new Set(lines.filter((l) => mine.has(l.display_ingredient_id)).map((l) => l.recipe_item_id));
          return [t.id, [...ids].flatMap((id) => byId.get(id) ?? []).sort((a, b) => a.name.localeCompare(b.name))];
        })
      );
    },
  });
}
