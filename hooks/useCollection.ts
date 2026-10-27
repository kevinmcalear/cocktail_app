import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { moveHeartsToCollection } from '@/hooks/useFavorites';
import { fetchPublicBars, fetchPublished, type PublishMode } from '@/hooks/usePublished';
import { track } from '@/lib/analytics';
import { memoryNow } from '@/lib/collectionMemory';
import { supabase } from '@/lib/supabase';

/**
 * A home bartender's collection: drinks they saved to make (the bookmark on
 * any drink they can read) and drinks and releases they collected from bars. Each keeps a memory (name, bar, picture, and for drinks when they had
 * it and a note) that outlives the bar unpublishing it. The spec only ever
 * comes from the live, published drink. Private to the collector; collecting
 * needs a confirmed age (get_my_age_check).
 */

export interface CollectedDrink {
  id: string;
  itemId: string | null;
  releaseId: string | null;
  collectedAt: string;
  name: string;
  barName: string | null;
  imageUrl: string | null;
  hadOn: string | null;
  note: string | null;
  /** The drink's public mode now, or null when it isn't published. */
  liveMode: PublishMode | null;
  /** Not published, but it still opens for them (a classic): not a memory. */
  readable: boolean;
  /** They can read its spec (its own row), published or not. */
  specOpens: boolean;
  /** A catalog classic, not a bar's drink. */
  classic: boolean;
}

export interface CollectedRelease {
  id: string;
  releaseId: string | null;
  collectedAt: string;
  name: string;
  barName: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
  /** Still live: its page opens. */
  live: boolean;
  /** Its drinks, while it's live. */
  itemIds: string[];
}

export interface Collection {
  drinks: CollectedDrink[];
  releases: CollectedRelease[];
}

// The last part is the shape's version: the cache is persisted, and an older shape mustn't come back.
const collectionKey = (userId: string | null) => ['collection', userId, 2] as const;

export function useCollection() {
  const userId = useUserId();
  return useQuery({
    queryKey: collectionKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<Collection> => {
      await moveHeartsToCollection();
      // ponytail: the whole collection in one page. A person collects dozens,
      // not thousands; page by collected_at if someone gets there.
      const [drinks, releases] = await Promise.all([
        supabase
          .from('collected_items')
          .select('id, item_id, release_id, collected_at, name, bar_name, image_url, had_on, note')
          .order('collected_at', { ascending: false }),
        supabase
          .from('collected_releases')
          .select('id, release_id, collected_at, name, bar_name, cover_url, release_date, release:releases(id, release_items(item_id, sort_order))')
          .order('collected_at', { ascending: false }),
      ]);
      if (drinks.error) throw drinks.error;
      if (releases.error) throw releases.error;
      const itemIds = (drinks.data ?? []).map((d) => d.item_id).filter((id): id is string => !!id);
      const live = await fetchPublished(itemIds);
      // The drinks whose own row they can read: their spec opens, whatever the bar published (a classic, say).
      const readable = itemIds.length ? await supabase.from('items').select('id, name, is_catalog').in('id', itemIds) : { data: [], error: null };
      if (readable.error) throw readable.error;
      const rows = (readable.data ?? []) as { id: string; name: string; is_catalog: boolean | null }[];
      // A drink they can still read shows as it is now (its name, bar and picture); the memory is for one they can't.
      const bars = await fetchPublicBars(live.map((p) => p.barId));
      const now = (id: string | null) => {
        const p = live.find((x) => x.id === id);
        const name = p?.name ?? rows.find((r) => r.id === id)?.name ?? null;
        return name ? { name, barName: bars.find((b) => b.barId === p?.barId)?.name ?? null, imageUrl: p?.imageUrl ?? null } : null;
      };
      const opens = new Set(rows.map((r) => r.id));
      const classics = new Set(rows.filter((r) => r.is_catalog).map((r) => r.id));
      const isLive = (id: string | null) => live.some((p) => p.id === id);
      return {
        drinks: (drinks.data ?? []).map((d) => {
          const shown = memoryNow({ name: d.name, barName: d.bar_name, imageUrl: d.image_url }, now(d.item_id));
          return {
            id: d.id,
            itemId: d.item_id,
            releaseId: d.release_id,
            collectedAt: d.collected_at,
            name: shown.name ?? 'A drink',
            barName: shown.barName,
            imageUrl: shown.imageUrl,
            hadOn: d.had_on,
            note: d.note,
            liveMode: live.find((p) => p.id === d.item_id)?.publishMode ?? null,
            readable: !!d.item_id && !isLive(d.item_id) && opens.has(d.item_id),
            specOpens: !!d.item_id && opens.has(d.item_id),
            classic: !!d.item_id && classics.has(d.item_id),
          };
        }),
        releases: (releases.data ?? []).map((r) => ({
          id: r.id,
          releaseId: r.release_id,
          collectedAt: r.collected_at,
          name: r.name ?? 'A release',
          barName: r.bar_name,
          coverUrl: r.cover_url,
          releaseDate: r.release_date,
          // The embed is null once the release isn't live (RLS) or is gone.
          live: !!r.release,
          // One release per row, though the embed is typed as a list.
          itemIds: [...((r.release as { release_items: { item_id: string; sort_order: number | null }[] } | null)?.release_items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((i) => i.item_id),
        })),
      };
    },
  });
}

type CollectChange =
  | { kind: 'drink'; itemId: string; releaseId?: string | null }
  | { kind: 'release'; releaseId: string }
  | { kind: 'remove-drink'; id: string }
  | { kind: 'remove-release'; id: string };

/** Collect or let go of a drink or a release. */
export function useCollect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: CollectChange) => {
      const { error } =
        change.kind === 'drink'
          ? await supabase.from('collected_items').insert({ item_id: change.itemId, release_id: change.releaseId ?? null })
          : change.kind === 'release'
            ? await supabase.from('collected_releases').insert({ release_id: change.releaseId })
            : await supabase.from(change.kind === 'remove-drink' ? 'collected_items' : 'collected_releases').delete().eq('id', change.id);
      // Already collected (a double tap, or another device): nothing to do.
      if (error && error.code !== '23505') throw new Error(error.message);
    },
    onSuccess: (_, change) => {
      if (change.kind === 'drink' || change.kind === 'release') track('drink_collected', { kind: change.kind });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['collection'] }),
    onError: () => {},
  });
}

/** The collector's own part of a memory: when they had it, and a note. */
export function useUpdateMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hadOn, note }: { id: string; hadOn: string | null; note: string | null }) => {
      const { error } = await supabase.from('collected_items').update({ had_on: hadOn, note }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['collection'] }),
    onError: () => {},
  });
}
