// A guest's own allergies and the allergen lines guests read
// (20261204400000_takeovers_and_allergens.sql). The allergies stay private:
// on the account (user_prefs, its owner's alone) or on this phone; matching
// happens here, so they are never sent in a request.
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import type { Allergen, GuestDrinkAllergens } from '@/lib/allergens';
import { viewerScoped } from '@/lib/authCache';
import { deviceStore } from '@/lib/deviceStore';
import { ACCOUNT_ALLERGIES_KEY, allergyCopy, allergyCopyFor, GUEST_ALLERGIES_KEY, mergeAllergies, myAllergiesKey as myKey } from '@/lib/myAllergies';
import { supabase } from '@/lib/supabase';


async function guestList(): Promise<Allergen[] | null> {
  const raw = await deviceStore.getItem(GUEST_ALLERGIES_KEY);
  return raw ? (JSON.parse(raw) as Allergen[]) : null;
}

/** Every allergen of these drinks (up to 200), the unchecked count and the bar's check date; signed out too. */
export function useGuestDrinkAllergens(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['guest-drink-allergens', ids, viewer.key],
    meta: viewer.meta,
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
 * Null: never set. Signing in brings the phone's list to the account, added
 * to what's there rather than losing either. Signed in, the phone keeps a
 * copy, so the warning still shows with no signal behind a bar.
 */
export function useMyAllergies() {
  const userId = useUserId();
  const client = useQueryClient();
  const viewer = viewerScoped(userId);
  return useQuery({
    queryKey: myKey(viewer.key),
    meta: viewer.meta,
    queryFn: async (): Promise<Allergen[] | null> => {
      const guest = await guestList();
      if (!userId) return guest;
      const { data, error } = await supabase.from('user_prefs').select('allergies').maybeSingle();
      // No signal: the phone's lists, rather than no warning at all.
      if (error) {
        const kept = mergeAllergies(allergyCopyFor(await deviceStore.getItem(ACCOUNT_ALLERGIES_KEY), userId), guest);
        if (kept) return kept;
        throw error;
      }
      const mine = mergeAllergies(data?.allergies as Allergen[] | null | undefined, guest);
      if (guest && mine) {
        // If this fails the phone's list stays, and the next read tries again.
        const saved = await supabase.from('user_prefs').upsert({ user_id: userId, allergies: mine });
        if (!saved.error) {
          await deviceStore.removeItem(GUEST_ALLERGIES_KEY);
          client.removeQueries({ queryKey: myKey(viewerScoped(null).key), exact: true });
        }
      }
      if (mine) await deviceStore.setItem(ACCOUNT_ALLERGIES_KEY, allergyCopy(userId, mine));
      return mine;
    },
  });
}
