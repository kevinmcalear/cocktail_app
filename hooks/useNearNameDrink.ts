import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useDebounced } from '@/hooks/useDiscover';
import { readSameNameDrink, type SameNameDrink } from '@/hooks/useSameNameDrink';
import { useSearchNear } from '@/hooks/useSearchNear';
import { nearest } from '@/lib/nearName';
import { sameName } from '@/lib/sameName';
import { supabase } from '@/lib/supabase';

const DRINK = ['drink'] as const;

// ponytail: a bar's first 2,000 cocktails by name, more than any bar has; a server-side near_score over the bar's drinks if one ever does.
const BAR_NAMES = 2000;

/** A drink spelled close to a new drink's name, and whose it is. Plain JSON. */
export interface NearNameDrink {
  drink: SameNameDrink;
  /** "Pale Moth": the bar it's from. */
  bar: string;
  /** "Pale Moth · Collingwood", for the card's line. */
  place: string;
}

/**
 * A drink whose name is spelled close to the one being typed (whole-app
 * canvas, Search page, "Did you mean, everywhere": 3A), so "Salty Boy" meets
 * "Salti Boi" before there are two: the venue's own first (its names scored
 * on the device, lib/nearName), else one a bar pours anywhere
 * (public.search_near). Never the same name: useSameNameDrink has those.
 * Off with `enabled` false (an exact match, or a classic, is already shown).
 */
export function useNearNameDrink({ barId, venueName, name, enabled = true }: { barId: string | null; venueName: string | null; name: string; enabled?: boolean }) {
  const userId = useUserId();
  const typed = useDebounced(name.trim(), 300);
  const on = enabled && !!userId && typed.length >= 3;
  const { data: names } = useQuery({
    queryKey: ['bar-cocktail-names', barId],
    enabled: on && !!barId,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('items').select('id, name').eq('bar_id', barId!).eq('item_type', 'cocktail').order('name').limit(BAR_NAMES).abortSignal(signal);
      if (error) throw error;
      return data ?? [];
    },
  });
  const ours = on && names ? nearest(typed, names.filter((r) => !sameName(r.name, typed)), (r) => r.name, 1)[0] : undefined;
  // The venue's names first: the app's are asked only once those have none close.
  const ownChecked = !barId || !!names;
  const { data: hits } = useSearchNear(typed, { kinds: DRINK, enabled: on && ownChecked && !ours });
  const app = hits?.find((h) => !sameName(h.name, typed));
  const pick = ours ? { id: ours.id, place: venueName ?? '' } : app ? { id: app.spellingFor ?? app.id, place: app.caption ?? '' } : null;
  const { data: drink } = useQuery({
    queryKey: ['near-name-drink', pick?.id ?? null],
    enabled: on && !!pick,
    staleTime: 60_000,
    queryFn: () => readSameNameDrink(pick!.id),
  });
  if (!on || !pick || !drink || drink.id !== pick.id || typed !== name.trim()) return null;
  return { drink, bar: pick.place.split(' · ')[0], place: pick.place } satisfies NearNameDrink;
}
