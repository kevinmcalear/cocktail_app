import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface VenueEvent {
  id: string;
  bar_id: string;
  name: string;
  starts_at: string;
  ends_at: string | null;
  menu_id: string | null;
  covers_estimate: number | null;
  notes: string | null;
}

const COLUMNS = 'id, bar_id, name, starts_at, ends_at, menu_id, covers_estimate, notes';

/** A venue's events from this morning onwards (takeovers, private events), soonest first. */
export function useEvents(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['events', barId],
    enabled: !!barId,
    queryFn: async (): Promise<VenueEvent[]> => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('events')
        .select(COLUMNS)
        .eq('bar_id', barId!)
        .gte('starts_at', since.toISOString())
        .order('starts_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as VenueEvent[];
    },
  });
}

export interface NewEvent {
  bar_id: string;
  name: string;
  starts_at: string;
  menu_id: string | null;
  covers_estimate: number | null;
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: NewEvent): Promise<VenueEvent> => {
      const { data, error } = await supabase.from('events').insert(event).select(COLUMNS).single();
      if (error) throw error;
      return data as VenueEvent;
    },
    onSuccess: (event) => qc.invalidateQueries({ queryKey: ['events', event.bar_id] }),
  });
}
