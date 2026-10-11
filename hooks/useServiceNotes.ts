import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { cleanServiceNotes, EMPTY_SERVICE_NOTES, type ServiceNotes } from '@/lib/serviceNotes';
import { supabase } from '@/lib/supabase';

interface NotesRow {
  garnish: string | null;
  handoff: string[] | null;
  talking_point: string | null;
  sell_it_as: string | null;
}

const key = (itemId: string | null | undefined, userId: string | null) => ['service-notes', itemId, userId] as const;

/**
 * A venue drink's garnish, hand-off and talking points. The server returns
 * them from Employee up (talking_points); below that, and for a drink with
 * no venue, there's nothing to read, so `enabled` should say whether to ask.
 */
export function useServiceNotes(itemId: string | null | undefined, barId: string | null | undefined, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: key(itemId, userId),
    enabled: enabled && !!itemId && !!barId && !!userId,
    queryFn: async (): Promise<ServiceNotes> => {
      const { data, error } = await supabase
        .from('item_service_notes')
        .select('garnish, handoff, talking_point, sell_it_as')
        .eq('item_id', itemId!)
        .maybeSingle();
      if (error) throw error;
      const row = data as NotesRow | null;
      if (!row) return EMPTY_SERVICE_NOTES;
      return { garnish: row.garnish, handoff: row.handoff ?? [], talkingPoint: row.talking_point, sellItAs: row.sell_it_as };
    },
  });
}

/** Save the notes for a venue drink (its editors only; the database checks). */
export function useSaveServiceNotes(itemId: string, barId: string | null) {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (notes: ServiceNotes) => {
      if (!barId) throw new Error('Only a venue drink has service notes.');
      const n = cleanServiceNotes(notes);
      const { error } = await supabase
        .from('item_service_notes')
        .upsert({ item_id: itemId, bar_id: barId, garnish: n.garnish, handoff: n.handoff, talking_point: n.talkingPoint, sell_it_as: n.sellItAs }, { onConflict: 'item_id' });
      if (error) throw new Error("Couldn't save the notes. Check your connection and try again.");
      return n;
    },
    onSuccess: (n) => qc.setQueryData(key(itemId, userId), n),
    onError: () => {},
  });
}
