import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { normalizeHandle, type ProfileDraft } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

/** The signed-in person's own profile, public or not. */
export interface MyProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  isPublic: boolean;
  /** Shows the drinks you've had, with your scores, on your public profile. */
  sharesRankings: boolean;
  /** A moderator hid it: nobody else sees it, whatever isPublic says. */
  isModerated: boolean;
}

const myProfileKey = (userId: string | null) => ['profile', 'mine', userId] as const;

/** Your person profile, or null when you haven't made one. */
export function useMyProfile() {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: myProfileKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, handle, display_name, bio, is_public, shares_rankings, moderated_at')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        handle: data.handle,
        displayName: data.display_name,
        bio: data.bio,
        isPublic: data.is_public,
        sharesRankings: data.shares_rankings,
        isModerated: !!data.moderated_at,
      };
    },
  });
}

/** The table's answer, said the way a person would want to hear it. */
function readable(error: { code?: string; message: string; details?: string | null }): Error {
  if (error.code === '23505' && /handle/.test(`${error.message} ${error.details ?? ''}`)) {
    return new Error('That handle is taken. Try another.');
  }
  if (error.code === '23505') return new Error('You already have a profile. Reload to edit it.');
  return new Error('Couldn’t save your profile. Check the fields and try again.');
}

/**
 * Makes your profile (a person's, owned by you) or saves changes to it. RLS
 * lets a person write only their own; moderation stays with moderators.
 */
export function useSaveMyProfile() {
  const qc = useQueryClient();
  const userId = useAuth().user?.id ?? null;
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: ProfileDraft }) => {
      const row = {
        display_name: draft.name.trim(),
        handle: normalizeHandle(draft.handle),
        bio: draft.bio.trim() || null,
        is_public: draft.isPublic,
        shares_rankings: draft.sharesRankings,
      };
      const { error } = id
        ? await supabase.from('profiles').update(row).eq('id', id)
        : await supabase.from('profiles').insert({ ...row, kind: 'person', user_id: userId });
      if (error) throw readable(error);
    },
    // Every profile page, and anything that checks for a public profile, reads fresh.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
    // Shown inline by the form, not as the global toast.
    onError: () => {},
  });
}
