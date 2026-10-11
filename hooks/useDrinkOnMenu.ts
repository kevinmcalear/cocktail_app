import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/** A venue menu that's on now and lists this drink. Plain JSON. */
export interface OnMenu {
  menuId: string;
  name: string;
}

/**
 * Whether a venue's drink is on one of its menus tonight (is_active), for the
 * "On tonight's menu" tag and the "On the menu now" card. Venue menus are for
 * its team (menus RLS), so anyone else gets null.
 */
export function useDrinkOnMenu(itemId: string | null | undefined, barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['drink-on-menu', itemId, userId],
    enabled: !!itemId && !!barId && !!userId,
    queryFn: async (): Promise<OnMenu | null> => {
      const { data, error } = await supabase
        .from('menu_drinks')
        .select('menu:menus!inner(id, name, is_active, kind)')
        .eq('item_id', itemId!)
        .eq('menu.is_active', true)
        .limit(5);
      if (error) throw error;
      const rows = (data ?? []) as unknown as { menu: { id: string; name: string; kind: string } }[];
      const menu = rows.find((r) => r.menu.kind === 'menu')?.menu ?? rows[0]?.menu;
      return menu ? { menuId: menu.id, name: menu.name } : null;
    },
  });
}
