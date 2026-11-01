// A guest's own allergies and the allergen lines guests read
// (20261204400000_takeovers_and_allergens.sql). The allergies stay private:
// on the account (user_prefs, its owner's alone) or, signed out, on this
// phone; matching happens here, so they are never sent in a request.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import type { Allergen, GuestDrinkAllergens } from '@/lib/allergens';
import { deviceStore } from '@/lib/deviceStore';
import { supabase } from '@/lib/supabase';

const DEVICE_KEY = 'guest-allergies';
const myKey = (userId: string | null) => ['my-allergies', userId ?? 'device'] as const;

/** Every allergen of these drinks (up to 200), the unchecked count and the bar's check date; signed out too. */
export function useGuestDrinkAllergens(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['guest-drink-allergens', ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, GuestDrinkAllergens>> => {
      // The function takes 200 ids at a time.
      const out = new Map<string, GuestDrinkAllergens>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase.rpc('guest_drink_allergens', { p_item_ids: ids.slice(i, i + 200) });
        if (error) throw error;
        for (const d of (data ?? []) as unknown as GuestDrinkAllergens[]) out.set(d.item_id, d);
      }
      return out;
    },
  });
}

/** The guest's allergies: their account's when signed in, else this phone's. */
export function useMyAllergies() {
  const userId = useUserId();
  return useQuery({
    queryKey: myKey(userId),
    queryFn: async (): Promise<Allergen[]> => {
      if (!userId) return JSON.parse((await deviceStore.getItem(DEVICE_KEY)) ?? '[]') as Allergen[];
      const { data, error } = await supabase.from('user_prefs').select('allergies').maybeSingle();
      if (error) throw error;
      if (data?.allergies) return data.allergies as Allergen[];
      // First time signed in: bring this phone's list to the account.
      const local = JSON.parse((await deviceStore.getItem(DEVICE_KEY)) ?? '[]') as Allergen[];
      if (local.length) {
        const saved = await supabase.from('user_prefs').upsert({ user_id: userId, allergies: local });
        if (saved.error) throw saved.error;
        await deviceStore.removeItem(DEVICE_KEY);
      }
      return local;
    },
  });
}

export function useSaveMyAllergies() {
  const userId = useUserId();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (allergies: Allergen[]) => {
      if (!userId) return deviceStore.setItem(DEVICE_KEY, JSON.stringify(allergies));
      const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, allergies });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: myKey(userId) }),
    onError: () => {},
  });
}

/** The bar checks a drink's allergen list now (or clears its check). The server stamps who, when and what. */
export function useCheckDrinkAllergens(itemId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (checked: boolean) => {
      const { error } = await supabase
        .from('items')
        .update({ allergens_checked_at: checked ? new Date().toISOString() : null })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['drink-allergens', itemId] }),
        client.invalidateQueries({ queryKey: ['guest-drink-allergens'] }),
      ]),
    onError: () => {},
  });
}
