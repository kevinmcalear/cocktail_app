import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { COCKTAIL_LIST_COLUMNS, withListRecipes } from '@/hooks/useCocktails';
import { useDebounced } from '@/hooks/useDiscover';
import { toCocktailSearchItem } from '@/hooks/useSearchCatalog';
import { menuOrder, runDates, searchMenuTag, type MenuRunRow } from '@/lib/menuEditions';
import { supabase } from '@/lib/supabase';
import type { SearchItem } from '@/types/search';

const SEARCH_DEBOUNCE_MS = 250;

/** A search_bar_drinks row: the run columns are null for a drink no menu lists. */
type FoundDrink = { item_id: string; credit: string | null } & { [K in keyof MenuRunRow]: MenuRunRow[K] | null };

/**
 * Drinks credited to a bar or bartender with no venue behind them: the
 * signatures and originals on public profiles, current and past menus. The
 * Library leaves these out; search lists them under "From bars", each tagged
 * with who it's credited to and when it was on the menu. Searched on the
 * server (search_bar_drinks), since there are thousands: drinks on a menu
 * now come first.
 */
export function usePublicDrinks(text: string) {
  const query = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['public-drinks', query],
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    meta: { persist: false },
    queryFn: async (): Promise<SearchItem[]> => {
      const found = await supabase.rpc('search_bar_drinks', { p_query: query });
      if (found.error) throw found.error;
      const rows = (found.data ?? []) as FoundDrink[];
      if (!rows.length) return [];

      const { data, error } = await supabase
        .from('app_item_presentation')
        .select(COCKTAIL_LIST_COLUMNS)
        .in('id', rows.map((r) => r.item_id));
      if (error) throw error;
      const drinks = new Map(withListRecipes(data).map((d) => [d.id, d]));

      return rows.flatMap((r) => {
        const drink = drinks.get(r.item_id);
        if (!drink) return [];
        const dates = r.start_year === null ? null : runDates(r as MenuRunRow);
        const tag = searchMenuTag(dates);
        const menuRun = tag ? (tag.onNow ? 'on now' : tag.past) : undefined;
        return [{ ...toCocktailSearchItem(drink), fromBar: r.credit ?? 'A bar', menuRun, menuOrder: menuOrder(dates) }];
      });
    },
  });
}
