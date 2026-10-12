import { useQuery } from '@tanstack/react-query';

import { dropdownKeys } from '@/hooks/useDropdowns';
import { MENU_DRINK_ITEM, type MenuItemRow } from '@/hooks/useMenus';
import { supabase } from '@/lib/supabase';

export interface CurrentSectionRow {
  id: string;
  menu_id: string;
  name: string;
  sort_order: number | null;
  menu_drinks: { sort_order: number | null; item: MenuItemRow | MenuItemRow[] | null }[] | null;
}

/**
 * The sections of the menus on now, each with its drinks (their line and
 * price), for Tonight. Rows as they come (plain JSON: saved between launches);
 * useTonight puts them in running order.
 */
export function useCurrentMenuDrinks(menuIds: string[]) {
  const key = [...menuIds].sort();
  return useQuery({
    queryKey: [...dropdownKeys.currentMenuDrinks, 'sections', key],
    enabled: key.length > 0,
    // Tonight's first paint: saved between launches.
    meta: { persist: true },
    queryFn: async (): Promise<CurrentSectionRow[]> => {
      const { data, error } = await supabase
        .from('menu_sections')
        .select(`id, menu_id, name, sort_order, menu_drinks(sort_order, ${MENU_DRINK_ITEM})`)
        .in('menu_id', key)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CurrentSectionRow[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
