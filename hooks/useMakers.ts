import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { originalsByIds, type Original } from '@/hooks/useProfiles';
import { supabase } from '@/lib/supabase';

export interface MakerBottle {
  id: string;
  name: string;
  abv: number | null;
  kind: string | null;
}

interface BottleRow {
  id: string;
  name: string;
  abv: number | null;
  generic: { name: string } | null;
}

// Bottles and drinks are signed-in reads, like the items themselves.

/** The bottles (and other products) that name this maker. */
export function useMakerBottles(profileId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['maker-bottles', profileId, userId],
    enabled: !!profileId && !!userId,
    queryFn: async (): Promise<MakerBottle[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, abv, generic:generic_id(name)')
        .eq('item_type', 'ingredient')
        .eq('maker_profile_id', profileId!)
        .order('name')
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as BottleRow[]).map((r) => ({ id: r.id, name: r.name, abv: r.abv, kind: r.generic?.name ?? null }));
    },
  });
}

/** Drinks whose ice or glass the maker made, once its team has confirmed the credit. */
export function useMakerDrinks(profileId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['maker-drinks', profileId, userId],
    enabled: !!profileId && !!userId,
    queryFn: async (): Promise<Original[]> => {
      const { data, error } = await supabase
        .from('item_maker_credits')
        .select('item_id')
        .eq('profile_id', profileId!)
        .not('confirmed_at', 'is', null)
        .limit(100);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.item_id as string))];
      return ids.length ? originalsByIds(ids) : [];
    },
  });
}
