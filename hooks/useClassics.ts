import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDrinkLists, type DrinkList } from '@/hooks/useDiscover';
import { useStartFromClassic } from '@/hooks/useStartFromClassic';
import { suggestClassic, type ClassicMatch } from '@/lib/classics';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';
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

/** The classics a venue already has a drink of (its cocktails' riff_of_id), each once. */
export function useVenueClassicCopies(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue-classic-copies', barId],
    enabled: !!barId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('items').select('riff_of_id').eq('bar_id', barId!).eq('item_type', 'cocktail').not('riff_of_id', 'is', null);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.riff_of_id as string))];
    },
  });
}

/**
 * Classics as the venue's own copies ("Start with 20 classics"): each one's
 * spec, method, glass, ice and garnish, credited as a version of it and to
 * nobody at the bar, saved the way the add-drink wizard saves. One that
 * fails is named, and the rest still go in.
 */
export function useAddClassicCopies(barId: string | null) {
  const client = useQueryClient();
  const start = useStartFromClassic();
  const create = useCreateDrink();
  return useMutation({
    mutationFn: async (classics: readonly { id: string; name: string }[]): Promise<{ failed: string[] }> => {
      const failed: string[] = [];
      for (const c of classics) {
        try {
          const spec = await start.mutateAsync(c.id);
          await create.mutateAsync({ draft: { ...EMPTY_DRAFT, ...spec, name: c.name, creator: 'nobody', elsewhere: true, place: null }, barId, myProfileId: null });
        } catch {
          failed.push(c.name);
        }
      }
      return { failed };
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['venue-classic-copies', barId] }),
  });
}
