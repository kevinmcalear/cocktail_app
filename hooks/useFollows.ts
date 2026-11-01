import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';

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

const followsKey = (userId: string | null) => ['follows', userId];

/** The people you follow (their user ids). */
export function useFollowing() {
  const userId = useUserId();
  return useQuery({
    queryKey: followsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('follows').select('followee_id').eq('follower_id', userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.followee_id);
    },
  });
}

/** Follow or stop following someone (by user id). */
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
