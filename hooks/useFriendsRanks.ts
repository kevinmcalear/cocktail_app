import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

// What Tonight reads about people you follow. Apart from useFollows (the
// people pages, follow and unfollow), so Tonight's page doesn't carry those.

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

export const followsKey = (userId: string | null) => ['follows', userId];

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

/** Recent ranks by people you follow, newest first, as each of them shares them (friends_ranks). */
export function useFriendsRanks(limit = 5, enabled = true) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['friends-ranks', userId, limit],
    enabled: enabled && !!userId,
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
