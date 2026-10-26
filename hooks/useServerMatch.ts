import { useQueries } from '@tanstack/react-query';

import { PAGE_ROWS } from '@/lib/allRows';
import type { Reading } from '@/lib/match';
import { shortlistCatalog, type ShortlistRow } from '@/lib/matchCatalog';
import { supabase } from '@/lib/supabase';

/** Readings per request: a few rows each, well under the server's 1,000 rows a request. */
const PER_REQUEST = 10;

const plain = (r: Reading) => ({ name: r.name, brand: r.brand ?? null, kind: r.kind ?? null });

/**
 * Snap a bottle matched on the server (match_ingredients): the catalog rows
 * the matcher lands on for these readings, so a snap needn't download the
 * whole catalog. Each group (the photo's bottles, a name typed in) is asked
 * ten readings a request, kept a few minutes. `failed`: a request couldn't
 * be made (an error, or no connection), so match on the phone instead.
 */
export function useServerMatch(groups: readonly (readonly Reading[])[], venueId: string | null, enabled = true) {
  const asks = enabled ? groups.flatMap((g) => Array.from({ length: Math.ceil(g.length / PER_REQUEST) }, (_, i) => g.slice(i * PER_REQUEST, (i + 1) * PER_REQUEST).map(plain))) : [];
  return useQueries({
    queries: asks.map((sent) => ({
      queryKey: ['match-ingredients', venueId, sent],
      meta: { persist: false },
      staleTime: 5 * 60_000,
      retry: 1,
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<ShortlistRow[]> => {
        const { data, error } = await supabase.rpc('match_ingredients', { p_readings: sent, ...(venueId ? { p_venue_id: venueId } : {}) }).abortSignal(signal);
        if (error) throw error;
        // A full page may have been cut short, and a shortlist missing rows would match wrongly.
        if (data.length >= PAGE_ROWS) throw new Error('Too many matches to send at once.');
        return data;
      },
    })),
    combine: (results) => ({
      ...shortlistCatalog(results.flatMap((r) => r.data ?? [])),
      pending: results.some((r) => r.status === 'pending' && r.fetchStatus !== 'paused'),
      failed: results.some((r) => r.status === 'error' || (r.status === 'pending' && r.fetchStatus === 'paused')),
    }),
  });
}
