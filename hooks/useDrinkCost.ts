import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dropdownKeys } from '@/hooks/useDropdowns';
import { menuKeys } from '@/hooks/useMenus';
import { supabase } from '@/lib/supabase';

export interface CostLine {
  ingredient: string;
  /** Minor units for this line's amount; null when nothing on the way has a price. */
  minor: number | null;
  kind: 'ml' | 'g' | 'each';
  garnish: boolean;
}

export interface DrinkCost {
  liquid_minor: number;
  garnish_minor: number;
  ice_minor: number;
  total_minor: number;
  /** Lines with no price yet. */
  missing: number;
  lines: CostLine[];
}

/**
 * What a serve costs this bar (drink_cost). Runs as the caller, so it comes
 * back null for anyone without the costs capability; the section stays
 * locked for them.
 */
export function useDrinkCost(itemId: string | null | undefined, barId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['drink-cost', barId, itemId],
    enabled: !!itemId && !!barId && enabled,
    queryFn: async (): Promise<DrinkCost | null> => {
      const { data, error } = await supabase.rpc('drink_cost', { p_item: itemId!, p_bar: barId! });
      if (error) throw error;
      return (data as DrinkCost | null) ?? null;
    },
  });
}

/**
 * Writes drinks' prices, as typed ("19.50", "MP"; blank clears). A drink the
 * caller can't edit comes back with no row (RLS), which is an error here, so
 * a price never looks saved when it wasn't.
 */
async function writePrices(prices: Record<string, string | null>) {
  const results = await Promise.all(
    Object.entries(prices).map(([id, price]) => supabase.from('items').update({ price: price?.trim() || null }).eq('id', id).select('id'))
  );
  for (const { data, error } of results) {
    if (error) throw error;
    if (!data?.length) throw new Error('Couldn’t change that price: only people who can edit the drink can.');
  }
}

function useInvalidatePrices() {
  const queryClient = useQueryClient();
  return (ids: string[]) => {
    for (const id of ids) void queryClient.invalidateQueries({ queryKey: ['cocktail', id] });
    void queryClient.invalidateQueries({ queryKey: ['menu-costing'] });
    void queryClient.invalidateQueries({ queryKey: menuKeys.all });
    void queryClient.invalidateQueries({ queryKey: dropdownKeys.currentMenuDrinks });
  };
}

/**
 * The drink's one price, as typed ("19.50", "MP"), or null to clear it. Every
 * menu with the drink shows it, so menus refetch too.
 */
export function useSetDrinkPrice(itemId: string) {
  const invalidate = useInvalidatePrices();
  return useMutation({
    mutationFn: (price: string | null) => writePrices({ [itemId]: price }),
    onSuccess: () => invalidate([itemId]),
  });
}

/** Several drinks' prices at once: the menu builder's, after the menu saves. */
export function useSetDrinkPrices() {
  const invalidate = useInvalidatePrices();
  return useMutation({
    mutationFn: writePrices,
    onSuccess: (_, prices) => invalidate(Object.keys(prices)),
  });
}

/**
 * This menu's own price for a drink (menu_drinks.price), as typed; blank goes
 * back to the drink's. A menu the caller can't edit comes back with no row
 * (RLS), which is an error here.
 */
export function useSetMenuDrinkPrice(menuId: string, itemId: string) {
  const invalidate = useInvalidatePrices();
  return useMutation({
    mutationFn: async (price: string | null) => {
      const { data, error } = await supabase.from('menu_drinks').update({ price: price?.trim() || null }).eq('menu_id', menuId).eq('item_id', itemId).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Couldn’t change that price: only people who can edit the menu can.');
    },
    onSuccess: () => invalidate([itemId]),
  });
}
