// Saving a guest's own allergies: only Settings › Allergies does, so it stays
// out of hooks/useGuestAllergies.ts, which every web page loads.
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import type { Allergen } from '@/lib/allergens';
import { viewerScoped } from '@/lib/authCache';
import { deviceStore } from '@/lib/deviceStore';
import { ACCOUNT_ALLERGIES_KEY, allergyCopy, GUEST_ALLERGIES_KEY, myAllergiesKey as myKey } from '@/lib/myAllergies';
import { supabase } from '@/lib/supabase';

/** Saves your allergies: on your account and its copy here when signed in, else on this phone. */
export function useSaveMyAllergies() {
  const userId = useUserId();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (allergies: Allergen[]) => {
      if (!userId) return deviceStore.setItem(GUEST_ALLERGIES_KEY, JSON.stringify(allergies));
      const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, allergies });
      if (error) throw error;
      // What was saved started from the phone's list too, so one taken off stays off.
      await Promise.all([deviceStore.setItem(ACCOUNT_ALLERGIES_KEY, allergyCopy(userId, allergies)), deviceStore.removeItem(GUEST_ALLERGIES_KEY)]);
    },
    onSuccess: (_, allergies) => client.setQueryData(myKey(viewerScoped(userId).key), allergies),
    onError: () => {},
  });
}
