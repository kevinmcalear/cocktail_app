import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Allergen, DrinkAllergens } from '@/lib/allergens';
import { supabase } from '@/lib/supabase';

export interface AllergenDeclaration {
  allergens: Allergen[];
  checkedAt: string;
}

export interface ItemAllergens {
  /** The bar's own declaration, once it has checked the ingredient. */
  bar: AllergenDeclaration | null;
  /** The shared catalogue's. */
  catalogue: AllergenDeclaration | null;
}

interface AllergenRow {
  bar_id: string | null;
  allergen: string;
}

interface CheckRow {
  bar_id: string | null;
  checked_at: string;
}

function declaration(rows: AllergenRow[], checks: CheckRow[], barId: string | null): AllergenDeclaration | null {
  const check = checks.find((c) => c.bar_id === barId);
  if (!check) return null;
  return { allergens: rows.filter((r) => r.bar_id === barId).map((r) => r.allergen as Allergen), checkedAt: check.checked_at };
}

/** What's declared on an ingredient, by the catalogue and by this bar. */
export function useItemAllergens(itemId: string | null | undefined, barId: string | null) {
  return useQuery({
    queryKey: ['item-allergens', itemId, barId],
    enabled: !!itemId,
    queryFn: async (): Promise<ItemAllergens> => {
      const scope = barId ? `bar_id.is.null,bar_id.eq.${barId}` : 'bar_id.is.null';
      const [rows, checks] = await Promise.all([
        supabase.from('item_allergens').select('bar_id, allergen').eq('item_id', itemId!).or(scope),
        supabase.from('item_allergen_checks').select('bar_id, checked_at').eq('item_id', itemId!).or(scope),
      ]);
      if (rows.error) throw rows.error;
      if (checks.error) throw checks.error;
      const r = (rows.data ?? []) as AllergenRow[];
      const c = (checks.data ?? []) as CheckRow[];
      return { bar: barId ? declaration(r, c, barId) : null, catalogue: declaration(r, c, null) };
    },
  });
}

/**
 * Replaces an ingredient's declared allergens for a bar (or the catalogue)
 * and stamps the check: the body of useSetItemAllergens, also used when the
 * add-drink wizard saves a new prep whose allergens were set by hand.
 */
export async function saveItemAllergens(itemId: string, barId: string | null, allergens: Allergen[]) {
  const rows = supabase.from('item_allergens').delete().eq('item_id', itemId);
  const gone = await (barId ? rows.eq('bar_id', barId) : rows.is('bar_id', null));
  if (gone.error) throw gone.error;
  if (allergens.length) {
    const added = await supabase.from('item_allergens').insert(allergens.map((allergen) => ({ item_id: itemId, bar_id: barId, allergen })));
    if (added.error) throw added.error;
  }
  const checks = supabase.from('item_allergen_checks').delete().eq('item_id', itemId);
  const oldCheck = await (barId ? checks.eq('bar_id', barId) : checks.is('bar_id', null));
  if (oldCheck.error) throw oldCheck.error;
  const check = await supabase.from('item_allergen_checks').insert({ item_id: itemId, bar_id: barId });
  if (check.error) throw check.error;
}

/**
 * Declare an ingredient's allergens for a bar (or for the catalogue when
 * barId is null). Saving is the check: the whole set is replaced and the
 * check is stamped with this person, now. An empty set means "checked,
 * none", which is different from never checked.
 */
export function useSetItemAllergens(itemId: string, barId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allergens: Allergen[]) => saveItemAllergens(itemId, barId, allergens),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['item-allergens', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['drink-allergens'] });
      void queryClient.invalidateQueries({ queryKey: ['line-allergens'] });
      void queryClient.invalidateQueries({ queryKey: ['guest-drink-allergens'] });
    },
  });
}

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
 * A drink's allergens, rolled up from its recipe on the server, with the
 * ingredient path masked like the spec. Null when the drink can't be opened.
 */
export function useDrinkAllergens(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['drink-allergens', itemId],
    enabled: !!itemId,
    staleTime: 60_000,
    queryFn: async (): Promise<DrinkAllergens | null> => {
      const { data, error } = await supabase.rpc('drink_allergens', { p_item_id: itemId! });
      if (error) throw error;
      return (data as DrinkAllergens | null) ?? null;
    },
  });
}
