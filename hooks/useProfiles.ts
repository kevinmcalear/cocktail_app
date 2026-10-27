import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { viewerScoped } from '@/lib/authCache';
import type { ProfileKind } from '@/lib/lineage';
import type { PageVisibility } from '@/lib/pageVisibility';
import { parseProfileRef, type ShareMode, type ShareSection } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

// The profile's other hooks live in their own files; this one re-exports them
// so every caller keeps importing from '@/hooks/useProfiles'.
// ponytail: callers can move to the focused files over time; new code should import from them directly.
export { changedProfiles } from '@/lib/profiles';
export * from '@/hooks/useMenuRuns';
export * from '@/hooks/useProfileAwards';
export * from '@/hooks/useProfileClaims';
export * from '@/hooks/useProfileOriginals';
export * from '@/hooks/useProfilePositions';

export interface Profile {
  id: string;
  kind: ProfileKind;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  instagram: string | null;
  /** Facebook, TikTok, X, YouTube and Threads pages, as links. */
  social_links: string[] | null;
  locality: string | null;
  city: string | null;
  country_code: string | null;
  bar_id: string | null;
  is_public: boolean;
  /** False for a historic creator or a bar not on the app. (The owner's user_id is hidden from signed-out visitors.) */
  is_claimed: boolean;
  /** A bar that has shut for good; closed_year when it's known. */
  is_closed: boolean;
  closed_year: number | null;
  /** How much of the drinks they've had a person shows, with their scores. */
  had_mode: ShareMode;
  /** The bars they've had drinks at, with their average at each. */
  bars_mode: ShareMode;
  /** The drinks they've made. A bar's always show. */
  made_mode: ShareMode;
  /** A bar's: who outside it sees its page. Null for a person. */
  page_visibility: PageVisibility | null;
  /** A person's own line under their name ("Home bartender"). */
  tagline: string | null;
  /** Or one of their jobs, shown while the bar has confirmed it (profileLine). */
  headline_position_id: string | null;
  /** A maker's: what it makes (bottles, ice, glassware...). Empty for bars and people. */
  makes: string[];
  /** A maker's or supplier's: the cities it delivers to. */
  serves: string[];
  /** A supplier's: what it supplies (bottles, ice, produce...). Empty for everyone else. */
  supplies: string[];
  /** A maker's group (Tanqueray is part of Diageo), set by moderators. */
  part_of_profile_id: string | null;
}

const COLUMNS = 'id, kind, handle, display_name, bio, avatar_url, website, instagram, social_links, locality, city, country_code, bar_id, is_public, is_claimed, is_closed, closed_year, had_mode, bars_mode, made_mode, page_visibility, tagline, headline_position_id, makes, serves, supplies, part_of_profile_id';

export const isUnclaimed = (p: Pick<Profile, 'is_claimed'>) => !p.is_claimed;

/** A profile by id or handle (a /p/<ref> link). Public ones for anyone; private ones for their owner. */
export function useProfile(ref: string | string[] | null | undefined) {
  const parsed = parseProfileRef(ref);
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile', parsed, viewer.key],
    meta: viewer.meta,
    enabled: !!parsed,
    queryFn: async (): Promise<Profile | null> => {
      const query = supabase.from('profiles').select(COLUMNS);
      const { data, error } = await ('id' in parsed! ? query.eq('id', parsed.id) : query.eq('handle', parsed!.handle)).maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

/**
 * Where a merged person page went: the claimant's handle for an old /p/<handle>
 * or /p/<id> link, or null. Asked only once the profile itself isn't found.
 */
export function useMergedHandle(ref: string | string[] | null | undefined, enabled: boolean) {
  const parsed = parseProfileRef(ref);
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['mergedProfile', parsed, viewer.key],
    meta: viewer.meta,
    enabled: enabled && !!parsed,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('merged_profile_handle', { p_ref: 'id' in parsed! ? parsed.id : parsed!.handle });
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** A person's picks in one section, by bar profile or drink id: shown or hidden. Plain JSON. */
export type Picks = Record<string, boolean>;

/**
 * Which bars or originals a person picked to show or hide (profile_picks).
 * Anyone reads a profile's originals picks; only the person reads their bars.
 */
export function useProfilePicks(profileId: string | null | undefined, section: Exclude<ShareSection, 'had'>) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-picks', profileId, section, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId,
    queryFn: async (): Promise<Picks> => {
      const { data, error } = await supabase.from('profile_picks').select('target_id, shown').eq('profile_id', profileId!).eq('section', section).limit(1000);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.target_id as string, r.shown as boolean]));
    },
  });
}

/** Shows or hides one bar or original on your own profile. */
export function useSetPick() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pick: { profileId: string; section: Exclude<ShareSection, 'had'>; targetId: string; shown: boolean }) => {
      const { error } = await supabase
        .from('profile_picks')
        .upsert({ profile_id: pick.profileId, section: pick.section, target_id: pick.targetId, shown: pick.shown }, { onConflict: 'profile_id,section,target_id' });
      if (error) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-picks'] }),
    onError: () => {},
  });
}

/** Show all or Hide all of one section's bars or originals on your own profile. */
export function useSetPicks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, section, targetIds, shown }: { profileId: string; section: Exclude<ShareSection, 'had'>; targetIds: string[]; shown: boolean }) => {
      if (!targetIds.length) return;
      const rows = targetIds.map((target_id) => ({ profile_id: profileId, section, target_id, shown }));
      const { error } = await supabase.from('profile_picks').upsert(rows, { onConflict: 'profile_id,section,target_id' });
      if (error) throw new Error("Couldn't save that. Check your connection and try again.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-picks'] }),
    onError: () => {},
  });
}

/** A drink credited to a person at a bar whose page is Names or Private: its name and the bar, nothing more. */
export interface NameCredit {
  item_id: string;
  name: string;
  bar_profile_id: string;
  bar_handle: string;
  bar_name: string;
}

/** A person's name-only credits (get_profile_name_credits), signed in or out. */
export function useProfileNameCredits(profileId: string | null | undefined, enabled = true) {
  const viewer = viewerScoped(useUserId());
  return useQuery({
    queryKey: ['profile-name-credits', profileId, viewer.key],
    meta: viewer.meta,
    enabled: !!profileId && enabled,
    queryFn: async (): Promise<NameCredit[]> => {
      const { data, error } = await supabase.rpc('get_profile_name_credits', { p_profile_id: profileId! });
      if (error) throw error;
      return (data ?? []) as NameCredit[];
    },
  });
}
