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
 * Declare an ingredient's allergens for a bar (or for the catalogue when
 * barId is null). Saving is the check: the whole set is replaced and the
 * check is stamped with this person, now. An empty set means "checked,
 * none", which is different from never checked.
 */
export function useSetItemAllergens(itemId: string, barId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allergens: Allergen[]) => {
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
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['item-allergens', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['drink-allergens'] });
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
