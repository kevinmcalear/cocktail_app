import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { changedProfiles } from '@/hooks/useProfiles';
import { plainDbMessage } from '@/lib/dbError';
import { instagramProblem, normalizeHandle, normalizeInstagram, type ProfileDraft, type ShareMode, type ShareSection } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

/** The signed-in person's own profile, public or not. */
export interface MyProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  instagram: string | null;
  isPublic: boolean;
  /** How much of each section your public profile shows. */
  sharing: Record<ShareSection, ShareMode>;
  /** The drinks you show say when you had them. */
  showsDates: boolean;
  /** A moderator hid it: nobody else sees it, whatever isPublic says. */
  isModerated: boolean;
  tagline: string | null;
  headlinePositionId: string | null;
  showsPhoto: boolean;
}

const myProfileKey = (userId: string | null) => ['profile', 'mine', userId] as const;

/** Your person profile, or null when you haven't made one. */
export function useMyProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: myProfileKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, handle, display_name, bio, instagram, is_public, had_mode, bars_mode, made_mode, shows_dates, moderated_at, tagline, headline_position_id, shows_photo')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        handle: data.handle,
        displayName: data.display_name,
        bio: data.bio,
        instagram: data.instagram,
        isPublic: data.is_public,
        sharing: { had: data.had_mode as ShareMode, bars: data.bars_mode as ShareMode, originals: data.made_mode as ShareMode },
        showsDates: data.shows_dates,
        isModerated: !!data.moderated_at,
        tagline: data.tagline,
        headlinePositionId: data.headline_position_id,
        showsPhoto: data.shows_photo,
      };
    },
  });
}

/** The table's answer, said the way a person would want to hear it. */
function readable(error: { code?: string; message: string; details?: string | null }): Error {
  const said = plainDbMessage(error);
  if (said) return new Error(said);
  if (error.code === '23505' && /handle/.test(`${error.message} ${error.details ?? ''}`)) {
    return new Error('That handle is taken. Try another.');
  }
  if (error.code === '23505') return new Error('You already have a profile. Reload to edit it.');
  if (error.code === '23514' && /tagline/.test(`${error.message} ${error.details ?? ''}`)) return new Error('Keep the line under your name to 40 characters, on one line.');
  if (error.code === '23514' && /instagram/.test(`${error.message} ${error.details ?? ''}`)) {
    return new Error('Use up to 30 letters, numbers, dots or underscores. Dots can’t sit at the start, the end, or next to each other.');
  }
  // The content filter's own sentence ("That name has a word we don't allow").
  if (error.message.startsWith('That ') || error.message.startsWith('You already have a claim')) return new Error(error.message);
  return new Error('Couldn’t save your profile. Check the fields and try again.');
}

/**
 * Makes your profile (a person's, owned by you) or saves changes to it. RLS
 * lets a person write only their own; moderation stays with moderators.
 */
export function useSaveMyProfile() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: ProfileDraft }) => {
      const row = {
        display_name: draft.name.trim(),
        handle: normalizeHandle(draft.handle),
        bio: draft.bio.trim() || null,
        instagram: normalizeInstagram(draft.instagram) || null,
        is_public: draft.isPublic,
        tagline: draft.tagline.trim() || null,
        headline_position_id: draft.headlinePositionId,
        shows_photo: draft.showsPhoto,
      };
      const { error } = id
        ? await supabase.from('profiles').update(row).eq('id', id)
        : await supabase.from('profiles').insert({ ...row, kind: 'person', user_id: userId });
      if (error) throw readable(error);
    },
    // Your profile (and anything that checks you have a public one) and its page read fresh.
    onSuccess: (_data, { id }) => qc.invalidateQueries(changedProfiles({ id, mine: true })),
    // Shown inline by the form, not as the global toast.
    onError: () => {},
  });
}

/** Sets Instagram on a profile the caller can already edit (their own, or a bar they can publish). */
export function useSaveProfileInstagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, raw }: { id: string; raw: string }) => {
      const problem = instagramProblem(raw);
      if (problem) throw new Error(problem);
      const { error } = await supabase.from('profiles').update({ instagram: normalizeInstagram(raw) || null }).eq('id', id);
      if (error) throw readable(error);
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries(changedProfiles({ id }));
      qc.invalidateQueries({ queryKey: ['bar-publishing'] });
    },
    onError: () => {},
  });
}

const MODE_COLUMN: Record<ShareSection, 'had_mode' | 'bars_mode' | 'made_mode'> = { had: 'had_mode', bars: 'bars_mode', originals: 'made_mode' };

/**
 * One sharing choice on your own profile, saved straight away (like the job
 * switches): a section's mode, or whether your drinks say when you had them.
 */
export function useSaveSharing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...change }: { id: string; section?: ShareSection; mode?: ShareMode; showsDates?: boolean }) => {
      const row = change.section && change.mode ? { [MODE_COLUMN[change.section]]: change.mode } : { shows_dates: !!change.showsDates };
      const { error } = await supabase.from('profiles').update(row).eq('id', id);
      if (error) throw readable(error);
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries(changedProfiles({ id, mine: true }));
      qc.invalidateQueries({ queryKey: ['profile-drinks'] });
      qc.invalidateQueries({ queryKey: ['profile-bars'] });
    },
    onError: () => {},
  });
}
