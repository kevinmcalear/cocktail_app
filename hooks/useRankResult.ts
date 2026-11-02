import { useMutation, useQuery } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { useFriendsRanks } from '@/hooks/useFollows';
import { CREDIT_COLUMNS } from '@/hooks/useLineage';
import { rankedAs } from '@/lib/ranking';
import { makerName, type ItemCredit } from '@/lib/whoMadeIt';
import { supabase } from '@/lib/supabase';

/**
 * The reasons on a rank (Loop-rank "What stood out?", Kept-score "And the
 * room?"): saved on the rank itself, readable by the ranker only. Each tap
 * sends the whole set, so the last one wins.
 */
export function useSetRankReasons() {
  return useMutation({
    // Each tap writes the whole set; one at a time, so a quick second tap can't land first and lose the first.
    scope: { id: 'rank-reasons' },
    mutationFn: async ({ entryId, reasons, room }: { entryId: string; reasons: string[]; room: string[] }) => {
      const { data, error } = await supabase.from('rank_entries').update({ reasons, room_reasons: room }).eq('id', entryId).select('id');
      if (error || !data?.length) throw new Error("Couldn't save that. Check your connection and try again.");
    },
  });
}

/**
 * Who made each drink, for "214 ranks · Jo Park": the lead creator with a
 * page, else the first named one. Only drinks you may read in `items`; a
 * bar's drink you can't read just has no name here.
 */
export function useDrinkMakers(itemIds: string[]) {
  const ids = [...new Set(itemIds)].sort();
  const { data } = useQuery({
    queryKey: ['drink-makers', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data: rows, error } = await supabase.from('items').select(`id, ${CREDIT_COLUMNS}`).in('id', ids.slice(0, 100));
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const row of (rows ?? []) as unknown as { id: string; credits: ItemCredit[] | null }[]) {
        const maker = makerName(row.credits);
        if (maker) out[row.id] = maker;
      }
      return out;
    },
  });
  return data ?? {};
}

/** A friend's rank of a drink in one list ("Your friends" on the rankings page). */
export interface ListFriendRank {
  entryId: string;
  itemId: string;
  name: string;
  venueName: string | null;
  score: number;
}

/**
 * The ranks of people you follow in one list: the drink itself, or a bar's
 * version of it (based on it as a riff). Read from friends_ranks, so only
 * what each of them shows, best first.
 *
 * ponytail: friends_ranks returns their 50 latest ranks across every list,
 * so an older rank of this drink can be missing. Upgrade path: a list
 * argument on friends_ranks (an existing definer function, so Kevin's).
 */
export function useFriendsInList(rankedAsId: string | null | undefined, enabled: boolean) {
  const userId = useUserId();
  const ranks = useFriendsRanks(50, enabled && !!rankedAsId);
  const rows = (enabled ? (ranks.data ?? []) : []).filter((r): r is typeof r & { itemId: string } => !!r.itemId);
  const ids = [...new Set(rows.map((r) => r.itemId))].sort();
  const versions = useQuery({
    queryKey: ['friends-in-list', userId, rankedAsId, ids.join(',')],
    enabled: enabled && !!rankedAsId && ids.length > 0,
    queryFn: async (): Promise<string[]> => {
      // The same rule Rank it files a rank under (lib/ranking rankedAs), so a friend's rank lands in the list it was ranked in.
      const { data, error } = await supabase.from('items').select('id, name, origin, based_on_id, based_on_kind, based_on:based_on_id ( id, name, is_catalog )').in('id', ids);
      if (error) throw error;
      // ponytail: the self-link embed can't be typed by supabase-js (see useRankTarget), so the rows are cast.
      const items = (data ?? []) as unknown as Parameters<typeof rankedAs>[0][];
      return items.filter((i) => rankedAs(i).id === rankedAsId).map((i) => i.id);
    },
  });
  const inList = new Set(versions.data ?? []);
  const list: ListFriendRank[] = rows
    .filter((r) => inList.has(r.itemId))
    .map((r) => ({ entryId: r.entryId, itemId: r.itemId, name: r.displayName, venueName: r.venueName, score: r.score }))
    .sort((a, b) => b.score - a.score);
  return { data: list, isLoading: ranks.isLoading || versions.isLoading, error: ranks.error ?? versions.error };
}
