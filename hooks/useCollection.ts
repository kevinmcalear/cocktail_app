import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { fetchPublished, type PublishMode } from '@/hooks/usePublished';
import { supabase } from '@/lib/supabase';

/**
 * A home bartender's collection: drinks and releases they collected from
 * bars. Each keeps a memory (name, bar, picture, and for drinks when they had
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
  /** The drink's public mode now, or null when it's no longer published (a memory). */
  liveMode: PublishMode | null;
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
}

export interface Collection {
  drinks: CollectedDrink[];
  releases: CollectedRelease[];
}

export type AgeCheck = 'confirmed' | 'under_age' | 'unknown';

const collectionKey = (userId: string | null) => ['collection', userId] as const;

export function useCollection() {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: collectionKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<Collection> => {
      // ponytail: the whole collection in one page. A person collects dozens,
      // not thousands; page by collected_at if someone gets there.
      const [drinks, releases] = await Promise.all([
        supabase
          .from('collected_items')
          .select('id, item_id, release_id, collected_at, name, bar_name, image_url, had_on, note')
          .order('collected_at', { ascending: false }),
        supabase
          .from('collected_releases')
          .select('id, release_id, collected_at, name, bar_name, cover_url, release_date, release:releases(id)')
          .order('collected_at', { ascending: false }),
      ]);
      if (drinks.error) throw drinks.error;
      if (releases.error) throw releases.error;
      const live = await fetchPublished((drinks.data ?? []).map((d) => d.item_id).filter((id): id is string => !!id));
      return {
        drinks: (drinks.data ?? []).map((d) => ({
          id: d.id,
          itemId: d.item_id,
          releaseId: d.release_id,
          collectedAt: d.collected_at,
          name: d.name ?? 'A drink',
          barName: d.bar_name,
          imageUrl: d.image_url,
          hadOn: d.had_on,
          note: d.note,
          liveMode: live.find((p) => p.id === d.item_id)?.publishMode ?? null,
        })),
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
        })),
      };
    },
  });
}

/** Whether the signed-in person has confirmed their age. Signed out: unknown. */
export function useAgeCheck() {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ['age-check', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async (): Promise<AgeCheck> => {
      const { data, error } = await supabase.rpc('get_my_age_check');
      if (error) throw error;
      return (data as AgeCheck | null) ?? 'unknown';
    },
  });
}

/** confirm_age: resolves the drinking age applied, or null when under age. */
export function useConfirmAge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ birthDate, countryCode }: { birthDate: string; countryCode: string }) => {
      const { data, error } = await supabase.rpc('confirm_age', { p_birth_date: birthDate, p_country_code: countryCode });
      if (error) throw new Error(error.message);
      return data as number | null;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['age-check'] }),
    onError: () => {},
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
