import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { readSameNameDrink, type SameNameDrink } from '@/hooks/useSameNameDrink';
import { useSearchNear } from '@/hooks/useSearchNear';
import { nearNamePick, type NearNamePick } from '@/lib/nearHits';
import { supabase } from '@/lib/supabase';

const DRINK = ['drink'] as const;

// ponytail: a bar's first 2,000 cocktails by name, more than any bar has; a server-side near_score over the bar's drinks if one ever does.
const BAR_NAMES = 2000;

/** A drink spelled close to a new drink's name, and whose it is. Plain JSON. */
export interface NearNameDrink extends Omit<NearNamePick, 'id'> {
  drink: SameNameDrink;
}

/**
 * A drink whose name is spelled close to the one being typed (whole-app
 * canvas, Search page, "Did you mean, everywhere": 3A), so "Salty Boy" meets
 * "Salti Boi" before there are two: the venue's own first (its names scored
 * on the device), else one a bar pours anywhere (public.search_near, which
 * waits for typing to pause). Never the same name: useSameNameDrink has
 * those. Off with `enabled` false (an exact match or a classic is shown).
 */
export function useNearNameDrink({ barId, venueName, name, enabled = true }: { barId: string | null; venueName: string | null; name: string; enabled?: boolean }): NearNameDrink | null {
  const userId = useUserId();
  const typed = name.trim();
  const on = enabled && !!userId && typed.length >= 3;
  const names = useQuery({
    queryKey: ['bar-cocktail-names', barId, userId],
    enabled: on && !!barId,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('items').select('id, name').eq('bar_id', barId!).eq('item_type', 'cocktail').order('name').limit(BAR_NAMES).abortSignal(signal);
      if (error) throw error;
      return data ?? [];
    },
  });
  const ours = on ? nearNamePick(typed, names.data, undefined, venueName) : null;
  // The app's drinks once the venue's have none close (or couldn't be read).
  const ownChecked = !barId || names.status !== 'pending';
  const { data: hits } = useSearchNear(typed, { kinds: DRINK, enabled: on && ownChecked && !ours });
  const pick = ours ?? (on ? nearNamePick(typed, undefined, hits, venueName) : null);
  const { data: drink } = useQuery({
    queryKey: ['near-name-drink', pick?.id ?? null, userId],
    enabled: on && !!pick,
    staleTime: 60_000,
    queryFn: () => readSameNameDrink(pick!.id),
  });
  if (!pick || !drink || drink.id !== pick.id) return null;
  return { drink, bar: pick.bar, place: pick.place };
}
