import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

export interface CalendarSource {
  id: string;
  url: string;
  starts_public: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

/** A venue's calendar links (Calendars in Venue settings, and the owner's checklist). */
export function useCalendarSources(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['week', 'calendars', barId, userId],
    enabled: !!barId && !!userId,
    queryFn: async (): Promise<CalendarSource[]> => {
      const { data, error } = await supabase
        .from('calendar_sources')
        .select('id, url, starts_public, last_synced_at, last_error')
        .eq('bar_id', barId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as CalendarSource[];
    },
  });
}
