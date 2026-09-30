import { useQuery } from '@tanstack/react-query';

import { COCKTAIL_LIST_COLUMNS, withListRecipes } from '@/hooks/useCocktails';
import { toCocktailSearchItem } from '@/hooks/useSearchCatalog';
import { creditName, type PublicDrinkCredit } from '@/lib/publicDrinks';
import { supabase } from '@/lib/supabase';
import type { SearchItem } from '@/types/search';

/**
 * Drinks credited to a bar or bartender with no venue behind them: the
 * signatures and originals on public profiles. The Library leaves these out;
 * search lists them under "From bars", each tagged with who it's credited to.
 * ponytail: loads the whole set (a few hundred) once and filters on the
 * client like the rest of search. Past a few thousand, search on the server.
 */
export function usePublicDrinks(enabled: boolean) {
  return useQuery({
    queryKey: ['public-drinks'],
    enabled,
    queryFn: async (): Promise<SearchItem[]> => {
      const { data, error } = await supabase
        .from('app_item_presentation')
        .select(`${COCKTAIL_LIST_COLUMNS}, origin_bar_profile_id, creator_profile_id`)
        .eq('item_type', 'cocktail')
        .is('bar_id', null)
        .or('origin_bar_profile_id.not.is.null,creator_profile_id.not.is.null')
        .order('name')
        .limit(1000);
      if (error) throw error;
      const drinks = withListRecipes(data) as unknown as (PublicDrinkCredit & Record<string, unknown>)[];

      const ids = [...new Set(drinks.flatMap((d) => [d.origin_bar_profile_id, d.creator_profile_id]).filter((id): id is string => !!id))];
      const profiles = ids.length ? await supabase.from('profiles').select('id, display_name').in('id', ids) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const names: Record<string, string> = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p.display_name]));

      return drinks.map((d) => ({ ...toCocktailSearchItem(d), fromBar: creditName(d, names) ?? 'A bar' }));
    },
  });
}
