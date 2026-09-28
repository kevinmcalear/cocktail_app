import { useQuery } from '@tanstack/react-query';

import { citiesFrom, orderDrinks, type City } from '@/lib/discover';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { supabase } from '@/lib/supabase';

export interface DrinkList {
  id: string;
  name: string;
  imageUrl: string | null;
}

/**
 * The drink catalog: the shared classics you can find "the best" of (Martini,
 * Negroni). A bar's own martini is ranked in the Martini list through its
 * riff_of_id. Best-known first. Signed-in only, like every shared item.
 */
export function useDrinkLists() {
  return useQuery({
    queryKey: ['drink-lists'],
    queryFn: async (): Promise<DrinkList[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, item_images ( sort_order, is_generated, images ( url ) )')
        .eq('is_catalog', true)
        .order('name');
      if (error) throw error;
      const rows = (data ?? []) as unknown as { id: string; name: string; item_images: ItemImageLink[] | null }[];
      return orderDrinks(rows.map((r) => ({ id: r.id, name: r.name, imageUrl: heroPicture(r.item_images)?.url ?? null })));
    },
  });
}

/**
 * Cities with public bars, busiest first, for "Best Martini in …". Works
 * signed out. ponytail: reads every public bar's city, fine for a few
 * thousand bars. Upgrade path: an RPC that groups by city in SQL.
 */
export function useBarCities() {
  return useQuery({
    queryKey: ['bar-cities'],
    queryFn: async (): Promise<City[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('city, country_code')
        .eq('kind', 'bar')
        .eq('is_public', true)
        .not('city', 'is', null);
      if (error) throw error;
      return citiesFrom(data ?? []);
    },
  });
}
