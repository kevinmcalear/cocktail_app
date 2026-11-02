// What the bar's allergen check sheet reads and writes (AllergenCheckSheet.tsx). Apart
// from hooks/useAllergens and useGuestAllergies so guests' pages don't load it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DrinkAllergens } from '@/lib/allergens';
import { supabase } from '@/lib/supabase';

/** Whether one spec line has a list, on the bar's check sheet. */
export interface LineCheck {
  /** Every part of it has one: a bought ingredient checked (here or in the catalogue), or a house-made one whose every ingredient is. */
  listed: boolean;
  /** House-made: its allergens come from its own recipe. */
  houseMade: boolean;
}

/**
 * Each spec line's state for the bar's check (board Loop-allergy, "The bar
 * checks"), by recipes.id, as the roll-up decides it: a line is both its
 * ingredient and that ingredient's generic parent, and a recipe under either
 * makes it house-made. What each line contains comes from drink_allergens, so
 * the table can't disagree with what guests read. Plain JSON for the cache.
 */
export function useLineChecks(itemId: string, barId: string | null) {
  return useQuery({
    queryKey: ['line-allergens', itemId, barId],
    queryFn: async (): Promise<Record<string, LineCheck>> => {
      const { data: rows, error } = await supabase.from('recipes').select('id, ingredient_item_id, parent_ingredient_id').eq('recipe_item_id', itemId);
      if (error) throw error;
      const both = (r: (typeof rows)[number]) => [r.ingredient_item_id, r.parent_ingredient_id].filter((id): id is string => !!id);
      const ids = [...new Set(rows.flatMap(both))];
      const scope = barId ? `bar_id.is.null,bar_id.eq.${barId}` : 'bar_id.is.null';
      const [checks, parts] = await Promise.all([
        supabase.from('item_allergen_checks').select('item_id').in('item_id', ids).or(scope),
        Promise.all(
          ids.map(async (id) => {
            const { data, error: failed } = await supabase.rpc('drink_allergens', { p_item_id: id });
            if (failed) throw failed;
            return [id, data as DrinkAllergens | null] as const;
          }),
        ),
      ]);
      if (checks.error) throw checks.error;
      const checked = new Set((checks.data ?? []).map((c) => c.item_id));
      const recipes = new Map(parts.filter(([, d]) => !!d && d.lines > 0));
      return Object.fromEntries(
        rows.map((r) => {
          const made = both(r).flatMap((id) => recipes.get(id) ?? []);
          return [r.id, { listed: made.length ? made.every((d) => d.unchecked === 0) : both(r).some((id) => checked.has(id)), houseMade: made.length > 0 }];
        }),
      );
    },
  });
}

/**
 * For the team's check sheet (guests never see who): who checked a drink's
 * allergens, and, once a change cleared it, when the spec last changed after
 * that check (null: what's in it changed instead). Every spec save writes a
 * version, so the newest version is the spec's last change. `stale` is in the
 * key so the sheet reads it again when a change clears the check.
 */
export function useAllergenCheck(itemId: string, stale: boolean) {
  return useQuery({
    queryKey: ['allergens-checked-by', itemId, stale],
    queryFn: async (): Promise<{ by: string | null; specChanged: string | null }> => {
      const [item, version] = await Promise.all([
        supabase.from('items').select('allergens_checked_by, allergens_checked_at').eq('id', itemId).maybeSingle(),
        supabase.from('item_versions').select('created_at').eq('item_id', itemId).order('version', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (item.error) throw item.error;
      if (version.error) throw version.error;
      const checkedAt = item.data?.allergens_checked_at;
      const last = version.data?.created_at ?? null;
      return { by: item.data?.allergens_checked_by ?? null, specChanged: stale && checkedAt && last && last > checkedAt ? last : null };
    },
  });
}

/** The bar checks a drink's allergen list now (or clears its check). The server stamps who, when and what. */
export function useCheckDrinkAllergens(itemId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (checked: boolean) => {
      const { data, error } = await supabase
        .from('items')
        .update({ allergens_checked_at: checked ? new Date().toISOString() : null })
        .eq('id', itemId)
        .select('id');
      if (error) throw error;
      // RLS hides a row you can't edit rather than refusing: never let the page say checked when nothing was.
      if (!data?.length) throw new Error('Only someone who edits drinks here can check its allergens.');
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['drink-allergens', itemId] }),
        client.invalidateQueries({ queryKey: ['guest-drink-allergens'] }),
        client.invalidateQueries({ queryKey: ['allergens-checked-by', itemId] }),
      ]),
    onError: () => {},
  });
}
