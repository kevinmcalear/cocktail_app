// Whether you're a takeover's guest bartender at this bar (Keep-phone
// guestview). Apart from hooks/useTakeoverPage so Tonight's first load
// carries only this read, not the takeover page's.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface TakeoverGuest {
  menuId: string;
  /** The guest bar (the takeover's guest party), when it has one. */
  guestBar: string | null;
  /** When the guest role ends. */
  endsAt: string | null;
}

/**
 * You're a guest bartender at this bar: your role here (`venueRoleId`, from
 * the bars you're on, already loaded) is a takeover's, and it hasn't ended.
 * Null for the bar's own team. Off for anyone on no custom role, so most of
 * the team never waits on it. Tonight shows the guest's page then.
 */
export function useTakeoverGuest(barId: string | null | undefined, venueRoleId: string | null | undefined) {
  return useQuery({
    queryKey: ['takeover-guest', barId, venueRoleId],
    enabled: !!barId && !!venueRoleId,
    staleTime: 5 * 60_000,
    // Kept on the phone, so Tonight doesn't wait on it after the first load.
    meta: { persist: true },
    queryFn: async (): Promise<TakeoverGuest | null> => {
      const [roleRes, menuRes] = await Promise.all([
        supabase.from('venue_roles').select('ends_at').eq('id', venueRoleId!).maybeSingle(),
        supabase.from('menus').select('id').eq('bar_id', barId!).eq('list_type', 'takeover').eq('change_role_id', venueRoleId!).is('hidden_at', null).limit(1).maybeSingle(),
      ]);
      if (roleRes.error) throw roleRes.error;
      if (menuRes.error) throw menuRes.error;
      const endsAt = roleRes.data?.ends_at ?? null;
      if (!menuRes.data || (endsAt && Date.parse(endsAt) <= Date.now())) return null;
      const { data: party, error: partyError } = await supabase.from('menu_run_parties').select('name').eq('menu_id', menuRes.data.id).eq('kind', 'guest').order('sort_order').limit(1).maybeSingle();
      if (partyError) throw partyError;
      return { menuId: menuRes.data.id, guestBar: party?.name ?? null, endsAt };
    },
  });
}
