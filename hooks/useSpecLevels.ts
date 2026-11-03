import { useQuery } from '@tanstack/react-query';

import { recentItemFlags } from '@/hooks/itemFlags';
import { roleMatrixQuery } from '@/hooks/useCapabilities';
import { specLevelsFrom, type SpecLevels } from '@/lib/spec';
import { supabase } from '@/lib/supabase';

/**
 * The levels at which a venue drink's names, amounts and prep notes open:
 * where the venue's role permissions open them, and the drink's hide
 * (20261204300000_one_home.sql: permissions decide amounts). Used only to
 * label locked sections ("Opens at Bartender"); the server does the hiding.
 */
export function useSpecLevels(itemId: string | null | undefined, barId: string | null | undefined) {
  return useQuery({
    queryKey: ['spec-levels', itemId, barId],
    enabled: !!itemId && !!barId,
    staleTime: 5 * 60_000,
    queryFn: async ({ client }): Promise<SpecLevels | null> => {
      // The matrix is shared with the page's other role reads; the flag usually came with the drink.
      const flags = recentItemFlags(client, itemId!);
      const [rows, item] = await Promise.all([
        client.fetchQuery(roleMatrixQuery(barId!)),
        flags !== undefined ? { data: flags } : supabase.from('items').select('spec_hidden').eq('id', itemId!).maybeSingle(),
      ]);
      if (!rows.length) return null;
      // ponytail: if the item row isn't readable at this role, it reads as not hidden; the server still hides it.
      return specLevelsFrom(rows, item.data?.spec_hidden ?? false);
    },
  });
}
