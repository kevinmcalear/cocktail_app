import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Enum } from '@/types/db';

/** A drink someone named you on, waiting for your yes (20261121200000_co_credits_wait_for_yes). */
export interface CreditToCheck {
  item_id: string;
  name: string;
  item_type: Enum<'entity_type'>;
  /** The drink's first-named creator, when it has one. */
  creator_name: string | null;
  /** The bar it comes from, or the venue it's poured at. */
  bar_name: string | null;
  named_at: string;
}

/** The signed-in person's pending co-creator credits, newest first: "Credits to check" on You. */
export function useCreditsToCheck() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['credits-to-check', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CreditToCheck[]> => {
      const { data, error } = await supabase.rpc('credits_to_check');
      if (error) throw error;
      return (data ?? []) as CreditToCheck[];
    },
  });
}

/**
 * Says yes or no to a credit on a drink. Only the person named can; a no
 * hides it from everyone but them and the drink's editors, and either can be
 * changed later.
 */
export function useAnswerCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, accept }: { itemId: string; accept: boolean }): Promise<Enum<'co_creator_status'>> => {
      const { data, error } = await supabase.rpc('answer_credit', { p_item_id: itemId, p_accept: accept });
      // The database's own words when it refuses (no longer named on it); otherwise the connection.
      if (error) throw new Error(error.code === 'P0001' ? error.message : "Couldn't save that. Check your connection and try again.");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits-to-check'] });
      // Where co-creators show: drinks' credits and families (a riff shows in its classic's too), people's pages and find-yourself.
      qc.invalidateQueries({ queryKey: ['lineage'] });
      qc.invalidateQueries({ queryKey: ['waiting'] });
      qc.invalidateQueries({ queryKey: ['profile-originals'] });
      qc.invalidateQueries({ queryKey: ['my-made'] });
    },
    // Shown inline where the person answers, not as the global toast.
    onError: () => {},
  });
}
