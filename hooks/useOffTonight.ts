// Drinks off for tonight at a bar. Apart from hooks/useListAsks so a page that
// only reads them (the takeover's house list) doesn't carry the living list's code.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** A drink off for tonight only. */
export interface OffTonight {
  id: string;
  menuId: string;
  itemId: string;
  until: string;
}

export const offTonightKey = (barId: string) => ['off-tonight', barId] as const;

/** Drinks off for tonight at a bar, on any of its lists; a row past its close no longer counts. */
export function useOffTonight(barId: string | null | undefined) {
  return useQuery({
    queryKey: offTonightKey(barId ?? ''),
    enabled: !!barId,
    staleTime: 60_000,
    queryFn: async (): Promise<OffTonight[]> => {
      const { data, error } = await supabase
        .from('menu_off_tonight')
        .select('id, menu_id, item_id, until, menu:menus!inner(bar_id)')
        .eq('menu.bar_id', barId!)
        .gt('until', new Date().toISOString());
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, menuId: r.menu_id, itemId: r.item_id, until: r.until }));
    },
  });
}
