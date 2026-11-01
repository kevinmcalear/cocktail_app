import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * The drink kinds the person's venue role is limited to there (tf-059:
 * "Beer and wine"), or null when they add and edit every kind. The database
 * keeps them to these; the app uses it to hide what they can't do.
 */
export function useMyDrinkTypes(barId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['my-drink-types', barId, userId],
    enabled: !!barId && !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[] | null> => {
      const { data, error } = await supabase.rpc('my_drink_types', { p_bar_id: barId! });
      if (error) throw error;
      return (data as string[] | null) ?? null;
    },
  });
}

/** Whether a venue drink is waiting for approval (dec-25), and who added it. */
export function useDrinkApproval(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['drink-approval', itemId],
    enabled: !!itemId,
    staleTime: 30_000,
    queryFn: async (): Promise<{ waiting: boolean; createdBy: string | null; barId: string | null } | null> => {
      const { data, error } = await supabase.from('items').select('awaiting_approval, created_by, bar_id').eq('id', itemId!).maybeSingle();
      if (error) throw error;
      return data ? { waiting: data.awaiting_approval, createdBy: data.created_by, barId: data.bar_id } : null;
    },
  });
}

/** Approves a waiting drink. The database lets only people who edit every kind of drink at the venue. */
export function useApproveDrink() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('items').update({ awaiting_approval: false }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: (_, itemId) => client.invalidateQueries({ queryKey: ['drink-approval', itemId] }),
    onError: () => {},
  });
}
