import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSignedIn } from '@/ctx/AuthContext';
import { useDebounced } from '@/hooks/useDiscover';
import { areaParams, type Area } from '@/lib/nearMe';
import { fromRow, type NearHit, type NearKind, type NearRow } from '@/lib/nearHits';
import { supabase } from '@/lib/supabase';

const ANYWHERE: Area = { kind: 'anywhere' };

/**
 * Close names the database has for a search (public.search_near): the drinks
 * bars pour and bars in the area, people, and ingredients when asked. Needs
 * an account, as the drinks list does; three letters or more. Plain JSON.
 */
export function useSearchNear(query: string, { area = ANYWHERE, kinds, enabled = true }: { area?: Area; kinds: readonly NearKind[]; enabled?: boolean }) {
  const signedIn = useSignedIn();
  const q = useDebounced(query.trim(), 250);
  const where = areaParams(area);
  return useQuery({
    queryKey: ['search-near', q, kinds, where],
    enabled: enabled && signedIn && q.length >= 3 && kinds.length > 0,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<NearHit[]> => {
      const { data, error } = await supabase.rpc('search_near', { p_query: q, p_kinds: [...kinds], ...where, p_limit: 8 }).abortSignal(signal);
      // ponytail: a database without 20261109200000 has no close names; drop once it's in production.
      if (error?.code === 'PGRST202') return [];
      if (error) throw error;
      return ((data ?? []) as NearRow[]).map(fromRow).filter((h): h is NearHit => h !== null);
    },
  });
}

/** "Yes, that's it": keeps what was typed as another spelling of the drink (public.save_spelling). */
export function useSaveSpelling() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, typed }: { itemId: string; typed: string }) => {
      const { data, error } = await supabase.rpc('save_spelling', { p_item_id: itemId, p_typed: typed });
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['search-near'] }),
  });
}
