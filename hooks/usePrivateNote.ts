import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/** A note only its writer reads (20261025100000_item_private_notes). Plain JSON. */
export interface PrivateNote {
  body: string;
  updatedAt: string;
}

const key = (itemId: string | null | undefined, userId: string | null) => ['private-note', itemId, userId] as const;

/** Your own note on a drink, or null. Nobody else's: the database returns only yours. */
export function usePrivateNote(itemId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: key(itemId, userId),
    enabled: !!itemId && !!userId,
    queryFn: async (): Promise<PrivateNote | null> => {
      const { data, error } = await supabase.from('item_private_notes').select('body, updated_at').eq('item_id', itemId!).maybeSingle();
      if (error) throw error;
      return data ? { body: data.body as string, updatedAt: data.updated_at as string } : null;
    },
  });
}

/**
 * Write your note on a drink: a new one, a change, or (empty) take it away.
 * The writer is always you; the database checks you can read the drink.
 */
export async function savePrivateNote(itemId: string, text: string): Promise<PrivateNote | null> {
  const body = text.trim();
  if (!body) {
    const { error } = await supabase.from('item_private_notes').delete().eq('item_id', itemId);
    if (error) throw error;
    return null;
  }
  const updatedAt = new Date().toISOString();
  // Only the text and its time can change (the table grants no more), so not an upsert.
  const { data, error } = await supabase.from('item_private_notes').update({ body, updated_at: updatedAt }).eq('item_id', itemId).select('item_id');
  if (error) throw error;
  if (!data?.length) {
    const { error: added } = await supabase.from('item_private_notes').insert({ item_id: itemId, body });
    if (added) throw added;
  }
  return { body, updatedAt };
}

/** Change or remove your note on a drink, from its page. */
export function useSavePrivateNote(itemId: string) {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (text: string) => {
      try {
        return await savePrivateNote(itemId, text);
      } catch {
        throw new Error("Couldn't save your note. Check your connection and try again.");
      }
    },
    onSuccess: (note) => qc.setQueryData(key(itemId, userId), note),
    onError: () => {},
  });
}
