import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import type { PageVisibility } from '@/lib/pageVisibility';
import { supabase } from '@/lib/supabase';

export interface SpecLock {
  /** The bar whose page keeps the spec back, to name it and link to it. */
  bar: { id: string; handle: string; name: string; isClaimed: boolean; visibility: PageVisibility | null };
}

/**
 * Whether a drink credited to a bar keeps its spec from this viewer, because
 * the bar is unclaimed or its page isn't open (public.is_spec_locked, which
 * lets catalog admins and the bar's team through). Null when the spec isn't
 * locked. Only a shared drink credited to a bar can be.
 */
export function useSpecLock(item: { id: string; bar_id?: string | null; origin_bar_profile_id?: string | null } | null | undefined) {
  const viewer = viewerScoped(useUserId());
  const barProfileId = item && !item.bar_id ? (item.origin_bar_profile_id ?? null) : null;
  return useQuery({
    queryKey: ['spec-lock', item?.id, viewer.key],
    meta: viewer.meta,
    enabled: !!item && !!barProfileId,
    queryFn: async (): Promise<SpecLock | null> => {
      const [locked, profile] = await Promise.all([
        supabase.rpc('is_spec_locked', { p_item_id: item!.id }),
        supabase.from('profiles').select('id, handle, display_name, is_claimed, page_visibility').eq('id', barProfileId!).maybeSingle(),
      ]);
      if (locked.error) throw locked.error;
      if (profile.error) throw profile.error;
      if (!locked.data || !profile.data) return null;
      const p = profile.data as { id: string; handle: string; display_name: string; is_claimed: boolean; page_visibility: PageVisibility | null };
      return { bar: { id: p.id, handle: p.handle, name: p.display_name, isClaimed: p.is_claimed, visibility: p.page_visibility } };
    },
  });
}
