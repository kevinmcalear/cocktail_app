import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { chunk } from '@/lib/commandSearchGrid';
import { familyName } from '@/lib/follows';
import { personSearchFilter } from '@/lib/profiles';
import { roleLabel } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { Row } from '@/types/db';

export interface FriendRank {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  entryId: string;
  itemId: string | null;
  name: string;
  venueName: string | null;
  score: number;
  createdAt: string;
  drinkFamily: string | null;
  /** Now their top drink of its family. */
  bestInFamily: boolean;
}

/** A person you follow, who follows you, or one you found: their public page as a row. */
export interface FollowPerson {
  profileId: string;
  userId: string | null;
  handle: string;
  name: string;
  avatarUrl: string | null;
  /** "New York", when they show their city. */
  place: string | null;
  tagline: string | null;
  headlinePositionId: string | null;
  /** How much of what they've had they show ('none' keeps their ranks to themselves). */
  hadMode: string;
}

const PERSON_COLUMNS = 'id, user_id, handle, display_name, avatar_url, locality, city, shows_city, tagline, headline_position_id, had_mode';

type PersonRow = Pick<Row<'profiles'>, 'id' | 'user_id' | 'handle' | 'display_name' | 'avatar_url' | 'locality' | 'city' | 'shows_city' | 'tagline' | 'headline_position_id' | 'had_mode'>;

const toPerson = (r: PersonRow): FollowPerson => ({
  profileId: r.id,
  userId: r.user_id,
  handle: r.handle,
  name: r.display_name,
  avatarUrl: r.avatar_url,
  place: r.shows_city ? r.city || r.locality : null,
  tagline: r.tagline,
  headlinePositionId: r.headline_position_id,
  hadMode: r.had_mode,
});

const followsKey = (userId: string | null) => ['follows', userId];
const followersKey = (userId: string | null) => ['followers', userId];

/** The people you follow (their user ids), newest first. */
export function useFollowing() {
  const userId = useUserId();
  return useQuery({
    queryKey: followsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('follows').select('followee_id').eq('follower_id', userId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.followee_id);
    },
  });
}

/** The people who follow you (their user ids), newest first. Only you see these (follows_select). */
export function useFollowers() {
  const userId = useUserId();
  return useQuery({
    queryKey: followersKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('follows').select('follower_id').eq('followee_id', userId!).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.follower_id);
    },
  });
}

/**
 * Follow or stop following someone (by user id). The button flips at once
 * (the list is changed in the cache first) and flips back if it fails.
 */
export function useSetFollow() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ followeeId, on }: { followeeId: string; on: boolean }) => {
      const res = on
        ? await supabase.from('follows').upsert({ follower_id: userId!, followee_id: followeeId }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true })
        : await supabase.from('follows').delete().eq('follower_id', userId!).eq('followee_id', followeeId);
      if (res.error) throw res.error;
    },
    onMutate: async ({ followeeId, on }) => {
      await queryClient.cancelQueries({ queryKey: followsKey(userId) });
      const before = queryClient.getQueryData<string[]>(followsKey(userId));
      const rest = (before ?? []).filter((id) => id !== followeeId);
      queryClient.setQueryData<string[]>(followsKey(userId), on ? [followeeId, ...rest] : rest);
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(followsKey(userId), ctx.before);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: followsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: ['friends-ranks'] });
    },
  });
}

/** Recent ranks by people you follow, newest first, as each of them shares them (friends_ranks). */
export function useFriendsRanks(limit = 5) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['friends-ranks', userId, limit],
    enabled: !!userId,
    queryFn: async (): Promise<FriendRank[]> => {
      const { data, error } = await supabase.rpc('friends_ranks', { p_limit: limit });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        profileId: r.profile_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        entryId: r.entry_id,
        itemId: r.item_id,
        name: r.name,
        venueName: r.venue_name,
        score: Number(r.score),
        createdAt: r.created_at,
        drinkFamily: r.drink_family,
        bestInFamily: r.best_in_family,
      }));
    },
  });
}

/** Who owns a person's page (null for a page made from menus that nobody has claimed). */
export function useProfileUserId(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-user', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('profiles').select('user_id').eq('id', profileId!).maybeSingle();
      if (error) throw error;
      return data?.user_id ?? null;
    },
  });
}

/**
 * The public pages of these people, in the order given. Someone with no
 * public page (private, or never made one) can't be read here, so they're
 * left out; the caller counts them from the ids.
 */
export function usePeopleByUser(userIds: readonly string[] | undefined) {
  const ids = userIds ?? [];
  return useQuery({
    // In the order given (newest follow first), so a re-follow moves them back to the top.
    queryKey: ['follow-people', ids],
    enabled: ids.length > 0,
    // Following or unfollowing changes the ids: keep the list on screen while it refetches.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<FollowPerson[]> => {
      // ponytail: every page at once, 150 ids a request (the URL limit); People has no paging yet.
      const pages = await Promise.all(
        chunk([...ids], 150).map(async (batch) => {
          const { data, error } = await supabase.from('profiles').select(PERSON_COLUMNS).eq('kind', 'person').in('user_id', batch);
          if (error) throw error;
          return data ?? [];
        }),
      );
      const byUser = new Map(pages.flat().map((r) => [r.user_id, toPerson(r)]));
      return ids.flatMap((id) => byUser.get(id) ?? []);
    },
  });
}

/** Each drink's family (items.drink_family), by id, for the ones you may read: a person's favourite. */
export function useItemFamilies(itemIds: readonly string[]) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['item-families', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const pages = await Promise.all(
        chunk(ids, 150).map(async (batch) => {
          const { data, error } = await supabase.from('items').select('id, drink_family').in('id', batch);
          if (error) throw error;
          return data ?? [];
        }),
      );
      return Object.fromEntries(pages.flat().map((r) => [r.id, familyName(r.drink_family)]));
    },
  });
}

/** People's public pages by name or handle (Find people). Not you. */
export function useFindPeople(term: string) {
  const userId = useUserId();
  const q = term.trim().replace(/^@/, '').replace(/\s+/g, ' ');
  return useQuery({
    queryKey: ['find-people', q.toLowerCase(), userId],
    enabled: !!userId && q.length >= 2,
    queryFn: async ({ signal }): Promise<FollowPerson[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PERSON_COLUMNS)
        .eq('kind', 'person')
        .or(personSearchFilter(q))
        .order('display_name')
        .limit(20)
        .abortSignal(signal);
      if (error) throw error;
      return (data ?? []).filter((r) => r.user_id !== userId).map(toPerson);
    },
  });
}

/** Someone on a team with you (Find people's From your bars). */
export interface Barmate {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** "Head bartender, Caretaker’s". */
  line: string;
}

/** The people on your bars' teams, not you, each once (their first bar). */
export function useBarmates() {
  const userId = useUserId();
  const bars = useBars().data ?? [];
  const ids = bars.map((b) => b.bar_id).sort();
  return useQuery({
    queryKey: ['barmates', userId, ids],
    enabled: !!userId && ids.length > 0,
    queryFn: async (): Promise<Barmate[]> => {
      const lists = await Promise.all(
        bars.map(async (b) => {
          const { data, error } = await supabase.rpc('get_bar_members', { p_bar_id: b.bar_id });
          if (error) throw error;
          return (data ?? []).map((m) => ({ m, bar: b.bars?.name ?? '' }));
        }),
      );
      const seen = new Set<string>([userId!]);
      return lists.flat().flatMap(({ m, bar }) => {
        if (seen.has(m.user_id)) return [];
        seen.add(m.user_id);
        const role = m.venue_role_name || roleLabel(m.role_level);
        return [{ userId: m.user_id, name: m.display_name || 'Someone on your team', avatarUrl: m.avatar_url ?? null, line: bar ? `${role}, ${bar}` : role }];
      });
    },
  });
}
