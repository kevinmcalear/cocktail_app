import { useQuery } from '@tanstack/react-query';

import type { SpecNote } from '@/lib/servedAt';
import { supabase } from '@/lib/supabase';

export type SpecMatch = 'same' | 'unlisted' | 'variation' | 'riff';

export interface SpecMatchRow {
  item_id: string;
  classic_id: string;
  spec_match: SpecMatch;
  notes: SpecNote;
}

/**
 * Whether each of these bar versions of a classic is the classic itself, a
 * variation (and what it changes) or a riff, as this person sees the spec
 * (public.spec_matches, supabase/migrations/20261010610000_spec_match.sql).
 * `key` names the set (a classic's id, or a drink's own) so the cache key
 * stays short. Empty on a server without the function yet.
 */
export function useSpecMatches(key: string | undefined, ids: string[]) {
  return useQuery({
    queryKey: ['spec-matches', key, ids.length],
    enabled: !!key && ids.length > 0,
    queryFn: async (): Promise<Record<string, SpecMatchRow>> => {
      // ponytail: the function reads 500 drinks a call; a classic with more bar versions shows the first 500's.
      const { data, error } = await supabase.rpc('spec_matches', { p_item_ids: ids.slice(0, 500) });
      if (error) {
        if (error.code === 'PGRST202') return {};
        throw error;
      }
      return Object.fromEntries(((data ?? []) as SpecMatchRow[]).map((r) => [r.item_id, r]));
    },
  });
}
