import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import { parseHours, type WeekHours } from '@/lib/barHours';
import { supabase } from '@/lib/supabase';

/**
 * A bar's facts for its page, the Discover card and venue tools: where it is,
 * how to reach it, when it's open (supabase/migrations/20261014300000_bar_facts.sql).
 * Hours are typed by the venue; nothing comes from Google.
 */
export interface BarFacts {
  id: string;
  display_name: string;
  is_claimed: boolean;
  address_line: string | null;
  locality: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  phone: string | null;
  /** "Cocktail bar". */
  bar_type: string | null;
  opened_year: number | null;
  /** Null when the bar hasn't said. Read with lib/barHours (hoursStatus, weekRows). */
  hours: WeekHours | null;
  /** When the hours last changed (ISO). */
  hours_updated_at: string | null;
  /** The bar's IANA zone, so "Open now" is in the bar's time. */
  timezone: string | null;
}

/** Every column here is granted to signed-out readers (supabase/tests/bar-facts.test.mjs checks). */
export const BAR_FACT_COLUMNS = 'id, display_name, is_claimed, address_line, locality, city, latitude, longitude, website, phone, bar_type, opened_year, hours, hours_updated_at, timezone';

/** One bar profile's facts, for anyone who can read the page. */
export function useBarFacts(profileId: string | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['bar-facts', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<BarFacts | null> => {
      const { data, error } = await supabase.from('profiles').select(BAR_FACT_COLUMNS).eq('id', profileId!).eq('kind', 'bar').maybeSingle();
      if (error) throw error;
      return data ? { ...(data as Omit<BarFacts, 'hours'>), hours: parseHours((data as { hours: unknown }).hours) } : null;
    },
  });
}

export type BarFactsChange = Partial<Pick<BarFacts, 'website' | 'phone' | 'bar_type' | 'opened_year' | 'hours' | 'timezone'>>;

/** Save a bar's facts. RLS lets the venue's admins and catalog admins through; anyone else's save fails. */
export function useSaveBarFacts(profileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (change: BarFactsChange) => {
      const trimmed = Object.fromEntries(
        Object.entries(change).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v])
      );
      const { data, error } = await supabase.from('profiles').update(trimmed).eq('id', profileId).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('You can’t edit this bar’s details.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bar-facts', profileId] }),
  });
}
