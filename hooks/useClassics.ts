import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDrinkLists, type DrinkList } from '@/hooks/useDiscover';
import { suggestClassic, type ClassicMatch } from '@/lib/classics';
import { supabase } from '@/lib/supabase';

export interface UnlinkedDrink {
  id: string;
  name: string;
}

/**
 * A venue's cocktails that aren't linked to anything yet (no riff_of_id), for
 * "Match to classics". ponytail: one unpaginated read; fine for a few hundred
 * drinks per venue.
 */
export function useUnlinkedDrinks(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['unlinked-drinks', barId],
    enabled: !!barId,
    queryFn: async (): Promise<UnlinkedDrink[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name')
        .eq('bar_id', barId!)
        .eq('item_type', 'cocktail')
        .is('riff_of_id', null)
        .order('name');
      if (error) throw error;
      return (data ?? []) as UnlinkedDrink[];
    },
  });
}

/**
 * Link drinks to the catalog classic they're a version of (or unlink with
 * null), so they're ranked in that classic's list. Only riff_of_id changes,
 * which doesn't touch the drink's spec or queue a new sketch. RLS allows it
 * for the venue's editors.
 */
export function useLinkClassic() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (links: { itemId: string; classicId: string | null }[]) => {
      // A few at a time: "Link all" can be a hundred rows.
      for (let i = 0; i < links.length; i += 8) {
        const results = await Promise.all(
          links.slice(i, i + 8).map(({ itemId, classicId }) => supabase.from('items').update({ riff_of_id: classicId }).eq('id', itemId))
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }
    },
    onSettled: (_data, _error, links) => {
      void client.invalidateQueries({ queryKey: ['unlinked-drinks'] });
      void client.invalidateQueries({ queryKey: ['lineage'] });
      for (const { itemId } of links) void client.invalidateQueries({ queryKey: ['rank-target', itemId] });
    },
  });
}

export interface ClassicSuggestion {
  drink: UnlinkedDrink;
  match: ClassicMatch<DrinkList>;
}

/**
 * A venue's unlinked drinks with the classic each most likely is: same-name
 * matches first, then "contains" guesses, each A to Z. `unmatched` counts
 * the drinks with no likely classic.
 */
export function useClassicSuggestions(barId: string | null | undefined) {
  const catalog = useDrinkLists();
  const drinks = useUnlinkedDrinks(barId);
  const result = useMemo(() => {
    const suggestions: ClassicSuggestion[] = [];
    for (const drink of drinks.data ?? []) {
      const match = suggestClassic(drink.name, catalog.data ?? []);
      if (match) suggestions.push({ drink, match });
    }
    suggestions.sort((a, b) => Number(b.match.exact) - Number(a.match.exact) || a.drink.name.localeCompare(b.drink.name));
    return { suggestions, unmatched: (drinks.data?.length ?? 0) - suggestions.length };
  }, [catalog.data, drinks.data]);
  return { ...result, isLoading: catalog.isLoading || drinks.isLoading, error: catalog.error ?? drinks.error };
}
