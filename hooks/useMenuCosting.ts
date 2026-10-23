import { useQuery } from '@tanstack/react-query';

import type { DrinkCost } from '@/hooks/useDrinkCost';
import { supabase } from '@/lib/supabase';

export interface MenuCostRow {
  id: string;
  name: string;
  itemType: string;
  /** The drink's price as typed ("19.50", "MP"); the screen reads the number from it. */
  price: string | null;
  /** This menu's own price for it (menu_drinks.price), which costing uses when set. */
  menuPrice: string | null;
  /** Null when the drink has no spec to price, or the caller has no costs capability. */
  cost: DrinkCost | null;
}

/**
 * Every drink on a menu with its cost per serve (drink_cost, one call per
 * drink: menus are short), its price and this menu's, in menu order. Nothing comes
 * back without the costs capability, so the screen stays locked there.
 */
export function useMenuCosting(menuId: string | null | undefined, barId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['menu-costing', barId, menuId],
    enabled: !!menuId && !!barId && enabled,
    queryFn: async (): Promise<MenuCostRow[]> => {
      const menuRes = await supabase.from('menu_drinks').select('item_id, sort_order, price').eq('menu_id', menuId!).order('sort_order');
      if (menuRes.error) throw menuRes.error;
      const ids = [...new Set((menuRes.data ?? []).map((r) => r.item_id as string))];
      const menuPrices = new Map<string, string | null>();
      for (const r of menuRes.data ?? []) if (!menuPrices.has(r.item_id as string)) menuPrices.set(r.item_id as string, r.price);
      if (!ids.length) return [];
      const itemRes = await supabase.from('app_item_presentation').select('id, name, item_type, price').in('id', ids);
      if (itemRes.error) throw itemRes.error;
      const items = new Map((itemRes.data ?? []).map((i) => [i.id as string, i as { id: string; name: string; item_type: string; price: string | null }]));
      const costs = await Promise.all(
        ids.map(async (id) => {
          if (items.get(id)?.item_type !== 'cocktail') return null;
          const { data, error } = await supabase.rpc('drink_cost', { p_item: id, p_bar: barId! });
          if (error) throw error;
          return (data as DrinkCost | null) ?? null;
        })
      );
      return ids.flatMap((id, i) => {
        const item = items.get(id);
        return item ? [{ id, name: item.name, itemType: item.item_type, price: item.price, menuPrice: menuPrices.get(id) ?? null, cost: costs[i] }] : [];
      });
    },
  });
}
