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

/** A picker's row, marked when it's a close name rather than what was typed. Plain JSON. */
export type MaybeNear<T> = T & { near?: boolean };

/**
 * A picker's own search with its close names after it (whole-app canvas,
 * Search page, "Did you mean": 2A, 2B): what public.search_near finds of one
 * kind that the plain search missed, read by `read` with the picker's own
 * columns, closest first. Three letters or more; nothing on a database
 * without search_near.
 */
export async function withNear<T extends { id: string }>(
  term: string,
  kind: NearKind,
  rows: T[],
  read: (ids: string[]) => Promise<T[]>,
  signal: AbortSignal
): Promise<MaybeNear<T>[]> {
  if (term.trim().length < 3) return rows;
  const { data, error } = await supabase.rpc('search_near', { p_query: term.trim(), p_kinds: [kind], p_limit: 4 }).abortSignal(signal);
  // ponytail: a database without 20261109200000 has no close names; drop once it's in production.
  if (error?.code === 'PGRST202') return rows;
  if (error) throw error;
  const ids = ((data ?? []) as NearRow[]).map((r) => r.id).filter((id) => !rows.some((r) => r.id === id));
  if (!ids.length) return rows;
  const found = await read(ids);
  const near = ids.flatMap((id) => found.filter((r) => r.id === id)).map((r) => ({ ...r, near: true }));
  return [...rows, ...near];
}
