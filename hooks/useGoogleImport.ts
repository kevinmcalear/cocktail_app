import { useMutation, useQueryClient } from '@tanstack/react-query';

import { allRowsById } from '@/lib/allRows';
import { matchPlaces, type BarCandidate, type SavedPlace } from '@/lib/googleTakeout';
import { supabase } from '@/lib/supabase';

export type ImportBar = BarCandidate & { avatar_url: string | null };

/**
 * Our bars among someone's Google Maps places (disc-google-import). Reads
 * every open public bar's name and place and matches on the device, so
 * nothing from the file is sent anywhere, not even a point. A mutation, kept
 * in memory only: the matches never reach the persisted query cache.
 * ponytail: one read of every bar, fine for a few thousand bars (about 150 kB).
 * Upgrade path: an RPC that takes rounded map squares and returns the bars in them.
 */
export function useMatchSavedPlaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (places: SavedPlace[]) => {
      // Kept a few minutes in memory (never saved), so a second file doesn't read every bar again.
      const bars = await qc.fetchQuery({
        queryKey: ['import-bars'],
        staleTime: 5 * 60_000,
        meta: { persist: false },
        queryFn: () =>
          allRowsById<ImportBar>((after, size) => {
            let query = supabase.from('profiles').select('id, display_name, avatar_url, latitude, longitude, locality, city').eq('kind', 'bar').eq('is_public', true).eq('is_closed', false);
            if (after) query = query.gt('id', after);
            return query.order('id').limit(size);
          }),
      });
      return matchPlaces(places, bars);
    },
    onError: () => {},
  });
}
