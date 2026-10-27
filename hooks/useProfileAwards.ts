// A profile's list places and titled awards.
// Split out of hooks/useProfiles.ts, which still re-exports it.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import { sortAwards, type Award } from '@/lib/awards';
import { supabase } from '@/lib/supabase';

/** A profile's list places and titled awards, newest first. */
export function useProfileAwards(profileId: string | null | undefined) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-awards', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Award[]> => {
      const { data, error } = await supabase
        .from('profile_awards')
        .select('id, award, year, position, title, source_url, status, is_finalist, on_profile, added_by, bar:profiles!bar_profile_id(id, handle, display_name)')
        .eq('profile_id', profileId!);
      if (error) throw error;
      return sortAwards((data ?? []) as unknown as Award[]);
    },
  });
}

export interface NewAward {
  profileId: string;
  /** The awards body: "Tales of the Cocktail Spirited Awards". */
  award: string;
  title: string;
  year: number;
  isFinalist: boolean;
  barProfileId: string | null;
  sourceUrl: string;
}

/** Sends one of your own awards for checking. It comes in pending ("Not confirmed yet") until a moderator confirms it. */
export function useAddAward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: NewAward) => {
      const { error } = await supabase.from('profile_awards').insert({
        profile_id: a.profileId,
        award: a.award.trim(),
        title: a.title.trim(),
        year: a.year,
        is_finalist: a.isFinalist,
        bar_profile_id: a.barProfileId,
        source_url: a.sourceUrl.trim(),
      });
      if (error?.code === '23505') throw new Error('That award is already on your profile.');
      if (error?.code === '54000' || error?.message.startsWith('That ')) throw new Error(error.message);
      if (error) throw new Error('Couldn’t send that. Check the link starts with https:// and try again.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-awards'] }),
    // Shown inline by the sheet, not as the global toast.
    onError: () => {},
  });
}

/** Shows or hides one award on your own profile (its pick; profiles.awards_mode decides the rest). */
export function useSetAwardPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shown }: { id: string; shown: boolean }) => {
      const { data, error } = await supabase.from('profile_awards').update({ on_profile: shown }).eq('id', id).select('id');
      if (error || !data?.length) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-awards'] }),
    onError: () => {},
  });
}
