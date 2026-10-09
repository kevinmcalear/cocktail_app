import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { withPublishedItems } from '@/hooks/useRankings';
import { track } from '@/lib/analytics';
import type { ItemImageLink } from '@/lib/itemImages';
import { heroPicture } from '@/lib/itemImages';
import type { Compared, Swap } from '@/lib/madeIt';
import { supabase } from '@/lib/supabase';

/** One time someone made a drink at home. Plain JSON (the query cache is persisted). */
export interface MadeDrink {
  id: string;
  itemId: string;
  name: string;
  imageUrl: string | null;
  madeOn: string;
  compared: Compared | null;
  swaps: Swap[];
  note: string | null;
  rankEntryId: string | null;
}

interface MadeRow {
  id: string;
  item_id: string;
  made_on: string;
  compared: Compared | null;
  swaps: Swap[];
  note: string | null;
  rank_entry_id: string | null;
  item: { name: string; item_images: ItemImageLink[] | null } | null;
}

const madeKey = (userId: string | null) => ['made', userId] as const;

/** Everything you've made at home, latest first. Private to you (made_drinks). */
export function useMadeDrinks() {
  const userId = useUserId();
  return useQuery({
    queryKey: madeKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<MadeDrink[]> => {
      // ponytail: one page. People log dozens of nights in, not thousands; page by made_on past that.
      const { data, error } = await supabase
        .from('made_drinks')
        .select('id, item_id, made_on, compared, swaps, note, rank_entry_id, item:items!item_id(name, item_images(angle, sort_order, is_generated, images(url)))')
        .order('made_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      // A bar's drink a guest can't read in items still has its published name.
      const rows = await withPublishedItems((data ?? []) as unknown as MadeRow[]);
      return rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        name: r.item?.name ?? 'A drink',
        imageUrl: heroPicture(r.item?.item_images)?.url ?? null,
        madeOn: r.made_on,
        compared: r.compared,
        swaps: r.swaps ?? [],
        note: r.note,
        rankEntryId: r.rank_entry_id,
      }));
    },
  });
}

export interface NewMade {
  item_id: string;
  made_on: string;
  compared: Compared | null;
  swaps: Swap[];
  note: string | null;
  rank_entry_id: string | null;
}

/** Log a drink made at home. */
export function useLogMade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (made: NewMade) => {
      const { error } = await supabase.from('made_drinks').insert(made);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, made) => track('drink_made', { compared: made.compared ?? 'none', swaps: made.swaps.length }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['made'] }),
    onError: () => {},
  });
}
