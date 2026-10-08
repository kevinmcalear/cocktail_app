import { DROPDOWNS_QUERY_KEY } from '@/hooks/useDropdowns';
import { inRunningOrder } from '@/lib/currentFromMenus';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Drinks on current (is_active) menus, in running order (menuIds order, then sort_order). */
export function useCurrentMenuDrinks(menuIds: string[]) {
  const key = [...menuIds].sort();
  return useQuery({
    queryKey: [...DROPDOWNS_QUERY_KEY, 'current_menu_drinks', 'with-glass', key],
    enabled: key.length > 0,
    // Tonight's first paint: saved between launches.
    meta: { persist: true },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_drinks')
        .select(
          'menu_id, sort_order, item:items!item_id(id, name, item_type, glass:glassware_id(icon_key, name), item_images(angle, sort_order, is_generated, outdated_since, images(url)))'
        )
        .in('menu_id', key)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    // The cache key sorts menu ids; re-apply the caller's menu order on read.
    select: (rows) => inRunningOrder(rows, menuIds),
    staleTime: 1000 * 60 * 5,
  });
}
