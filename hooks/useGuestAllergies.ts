// A guest's own allergies and the allergen lines guests read
// (20261204400000_takeovers_and_allergens.sql). The allergies stay private:
// on the account (user_prefs, its owner's alone) and on this phone; matching
// happens here, so they are never sent in a request.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import type { Allergen, GuestDrinkAllergens } from '@/lib/allergens';
import { deviceStore } from '@/lib/deviceStore';
import { supabase } from '@/lib/supabase';

/** This phone's copy of your allergies: the list when signed out, a mirror of the account's when signed in (cleared at sign-out). */
export const GUEST_ALLERGIES_KEY = 'guest-allergies';
const myKey = (userId: string | null) => ['my-allergies', userId ?? 'device'] as const;

async function onPhone(): Promise<Allergen[] | null> {
  const raw = await deviceStore.getItem(GUEST_ALLERGIES_KEY);
  return raw ? (JSON.parse(raw) as Allergen[]) : null;
}

/** Every allergen of these drinks (up to 200), the unchecked count and the bar's check date; signed out too. */
export function useGuestDrinkAllergens(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['guest-drink-allergens', ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, GuestDrinkAllergens>> => {
      const { data, error } = await supabase.rpc('guest_drink_allergens', { p_item_ids: ids.slice(0, 200) });
      if (error) throw error;
      return new Map(((data ?? []) as unknown as GuestDrinkAllergens[]).map((d) => [d.item_id, d]));
    },
  });
}

/**
 * The guest's allergies: their account's when signed in, else this phone's.
 * Null: never set. Signed in, the phone keeps a copy, so the warning still
 * shows with no signal behind a bar.
 */
export function useMyAllergies() {
  const userId = useUserId();
  return useQuery({
    queryKey: myKey(userId),
    queryFn: async (): Promise<Allergen[] | null> => {
      const local = await onPhone();
      if (!userId) return local;
      const { data, error } = await supabase.from('user_prefs').select('allergies').maybeSingle();
      // No signal: the phone's copy, rather than no warning at all.
      if (error) {
        if (local) return local;
        throw error;
      }
      if (data?.allergies) {
        const mine = data.allergies as Allergen[];
        await deviceStore.setItem(GUEST_ALLERGIES_KEY, JSON.stringify(mine));
        return mine;
      }
      // First time signed in: bring this phone's list to the account.
      if (local) {
        const saved = await supabase.from('user_prefs').upsert({ user_id: userId, allergies: local });
        if (saved.error) throw saved.error;
      }
      return local;
    },
  });
}

/** Saves your allergies: on your account when signed in, and on this phone. */
export function useSaveMyAllergies() {
  const userId = useUserId();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (allergies: Allergen[]) => {
      if (userId) {
        const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, allergies });
        if (error) throw error;
      }
      await deviceStore.setItem(GUEST_ALLERGIES_KEY, JSON.stringify(allergies));
    },
    onSuccess: (_, allergies) => client.setQueryData(myKey(userId), allergies),
    onError: () => {},
  });
}

/** Who checked a drink's allergens, for its team's check sheet (guests never see who). */
export function useAllergenCheckedBy(itemId: string | null) {
  return useQuery({
    queryKey: ['allergens-checked-by', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('items').select('allergens_checked_by').eq('id', itemId!).maybeSingle();
      if (error) throw error;
      return data?.allergens_checked_by ?? null;
    },
  });
}

/** The bar checks a drink's allergen list now (or clears its check). The server stamps who, when and what. */
export function useCheckDrinkAllergens(itemId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (checked: boolean) => {
      const { data, error } = await supabase
        .from('items')
        .update({ allergens_checked_at: checked ? new Date().toISOString() : null })
        .eq('id', itemId)
        .select('id');
      if (error) throw error;
      // RLS hides a row you can't edit rather than refusing: never let the page say checked when nothing was.
      if (!data?.length) throw new Error('Only someone who edits drinks here can check its allergens.');
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['drink-allergens', itemId] }),
        client.invalidateQueries({ queryKey: ['guest-drink-allergens'] }),
        client.invalidateQueries({ queryKey: ['allergens-checked-by', itemId] }),
      ]),
    onError: () => {},
  });
}
