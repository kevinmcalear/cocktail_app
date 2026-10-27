import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/** A venue menu that's on now and lists this drink. Plain JSON. */
export interface OnMenu {
  menuId: string;
  name: string;
  /** That menu's own price for the drink, as typed; null when it prints the drink's. */
  price: string | null;
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
        .select('price, menu:menus!inner(id, name, is_active, kind)')
        .eq('item_id', itemId!)
        .eq('menu.is_active', true)
        .limit(5);
      if (error) throw error;
      const rows = (data ?? []) as { price: string | null; menu: { id: string; name: string; kind: string } }[];
      // ponytail: one menu on now, as the card shows one; a drink on two live menus notes the first's price. List them all if bars run several at once.
      const row = rows.find((r) => r.menu.kind === 'menu') ?? rows[0];
      return row ? { menuId: row.menu.id, name: row.menu.name, price: row.price?.trim() || null } : null;
    },
  });
}
