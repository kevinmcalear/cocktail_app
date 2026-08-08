import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Drinks on current (is_active) menus — used to derive Current cocktails. */
export function useCurrentMenuDrinks(menuIds: string[]) {
  const key = [...menuIds].sort();
  return useQuery({
    queryKey: [...DROPDOWNS_QUERY_KEY, 'current_menu_drinks', key],
    enabled: key.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_drinks')
        .select('menu_id, item:items!item_id(id, name, item_type)')
        .in('menu_id', key);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
