import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** How a bar buys one ingredient, for the cost of a drink not saved yet. */
export interface DraftPack {
  itemId: string;
  supplier: string | null;
  amount: number | null;
  unit: string | null;
  /** Null until the bar sets a pack price, or when this role can't read costs (RLS). */
  costMinor: number | null;
}

/**
 * The packs and pack prices of the ingredients in a drink being made, at a
 * venue: what the desktop page's cost adds up while the spec is written.
 * Prices come back only with the costs capability (item_costs' policy).
 */
export function useDraftPacks(barId: string | null | undefined, itemIds: readonly string[], enabled = true) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['draft-packs', barId, ids],
    enabled: !!barId && ids.length > 0 && enabled,
    queryFn: async (): Promise<DraftPack[]> => {
      const [packs, costs] = await Promise.all([
        supabase.from('item_purchasing').select('item_id, pack_size_amount, pack_size_unit, suppliers(name)').eq('bar_id', barId!).in('item_id', ids),
        supabase.from('item_costs').select('item_id, pack_cost_minor').eq('bar_id', barId!).in('item_id', ids),
      ]);
      if (packs.error) throw packs.error;
      if (costs.error) throw costs.error;
      const cost = new Map((costs.data ?? []).map((c) => [c.item_id as string, c.pack_cost_minor as number]));
      return (packs.data ?? []).map((p) => {
        const supplier = p.suppliers as { name: string } | { name: string }[] | null;
        return {
          itemId: p.item_id as string,
          supplier: (Array.isArray(supplier) ? supplier[0]?.name : supplier?.name) ?? null,
          amount: p.pack_size_amount as number | null,
          unit: p.pack_size_unit as string | null,
          costMinor: cost.get(p.item_id as string) ?? null,
        };
      });
    },
  });
}

/** The menu and section a new drink goes on ("Winter menu", "Long & bright"), for the page's header. */
export function useMenuSectionPlace(sectionId: string | null | undefined) {
  return useQuery({
    queryKey: ['menu-section-place', sectionId],
    enabled: !!sectionId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ menu: string | null; section: string | null } | null> => {
      const { data, error } = await supabase.from('menu_sections').select('name, menus(name)').eq('id', sectionId!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const menu = data.menus as { name: string | null } | { name: string | null }[] | null;
      return { menu: (Array.isArray(menu) ? menu[0]?.name : menu?.name) ?? null, section: data.name ?? null };
    },
  });
}
