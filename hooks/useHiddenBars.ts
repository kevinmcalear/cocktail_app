import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

/** A bar you keep off your Discover (hidden_bars, your own rows only). */
export interface HiddenBar {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  place: string | null;
}

interface HiddenRow {
  profile: { id: string; handle: string | null; display_name: string; avatar_url: string | null; locality: string | null; city: string | null } | null;
}

/** Discover's reads that leave hidden bars out (the map, drinks list, Top bars, rankings). */
const DISCOVER_KEYS = [['discover-top-bars'], ['discover-rankings'], ['discover-list'], ['discover-bars']];

/** Bars you hid, latest first. */
export function useHiddenBars() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['hidden-bars', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<HiddenBar[]> => {
      const { data, error } = await supabase
        .from('hidden_bars')
        .select('profile:profiles!profile_id(id, handle, display_name, avatar_url, locality, city)')
        .order('hidden_at', { ascending: false });
      if (error) throw error;
      // A page that went private drops out (its embed comes back empty).
      return ((data ?? []) as unknown as HiddenRow[]).flatMap((r) =>
        r.profile
          ? [{ id: r.profile.id, name: r.profile.display_name, handle: r.profile.handle, avatarUrl: r.profile.avatar_url, place: [r.profile.locality, r.profile.city].filter(Boolean).join(', ') || null }]
          : []
      );
    },
  });
}

/**
 * Hide a bar from your Discover, or show it again. Hiding a bar you love
 * stops loving it too: a bar can't lead your list and be off it. `relove`
 * (Undo after hiding a loved bar) loves it again in the same call, so it
 * still happens when the button that hid it has gone from the screen.
 */
export function useHideBar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, hide, relove = false }: { profileId: string; hide: boolean; relove?: boolean }) => {
      if (hide) {
        const { error } = await supabase.from('hidden_bars').upsert({ profile_id: profileId }, { onConflict: 'user_id,profile_id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        const unlove = await supabase.from('loved_bars').delete().eq('profile_id', profileId);
        if (unlove.error) {
          // Never leave it hidden and loved at once: undo the hide and say so.
          await supabase.from('hidden_bars').delete().eq('profile_id', profileId);
          throw new Error(unlove.error.message);
        }
        return;
      }
      const { error } = await supabase.from('hidden_bars').delete().eq('profile_id', profileId);
      if (error) throw new Error(error.message);
      if (relove) {
        const back = await supabase.from('loved_bars').upsert({ profile_id: profileId }, { onConflict: 'user_id,profile_id', ignoreDuplicates: true });
        if (back.error) throw new Error(back.error.message);
      }
    },
    onSettled: () => Promise.all([['hidden-bars'], ['loved-bars'], ...DISCOVER_KEYS].map((queryKey) => qc.invalidateQueries({ queryKey }))),
    onError: () => {},
  });
}
