import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** A venue's release as its publishers see it: drafts and scheduled ones too. */
export interface VenueRelease {
  id: string;
  name: string;
  description: string | null;
  releaseDate: string;
  publishedAt: string | null;
  moderatedAt: string | null;
  itemIds: string[];
}

interface ReleaseRow {
  id: string;
  name: string;
  description: string | null;
  release_date: string;
  published_at: string | null;
  moderated_at: string | null;
  release_items: { item_id: string; sort_order: number }[] | null;
}

/** Every release at a venue, newest date first. Only people who can publish there get any back. */
export function useVenueReleases(barId: string) {
  return useQuery({
    queryKey: ['venue-releases', barId],
    staleTime: 0,
    queryFn: async (): Promise<VenueRelease[]> => {
      const { data, error } = await supabase
        .from('releases')
        .select('id, name, description, release_date, published_at, moderated_at, release_items(item_id, sort_order)')
        .eq('bar_id', barId)
        .order('release_date', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ReleaseRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        releaseDate: r.release_date,
        publishedAt: r.published_at,
        moderatedAt: r.moderated_at,
        itemIds: [...(r.release_items ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.item_id),
      }));
    },
  });
}

export interface ReleaseDraft {
  id?: string;
  name: string;
  description: string;
  releaseDate: string;
  itemIds: string[];
}

/**
 * Save a release's details and drinks, and optionally when it goes public
 * (null takes it back to a draft). Drinks save first, since the database
 * won't publish a release with none, or with a drink that isn't public.
 * onCreated hears a new release's id as soon as it exists, so a retry after
 * a later step fails updates it instead of making a second one.
 */
export function useSaveRelease(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ draft, publishedAt, onCreated }: { draft: ReleaseDraft; publishedAt?: string | null; onCreated?: (id: string) => void }): Promise<string> => {
      const fields = { name: draft.name.trim(), description: draft.description.trim() || null, release_date: draft.releaseDate };
      let id = draft.id;
      if (id) {
        const { error } = await supabase.from('releases').update(fields).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('releases').insert({ ...fields, bar_id: barId }).select('id').single();
        if (error) throw error;
        id = (data as { id: string }).id;
        onCreated?.(id);
      }

      let removed = supabase.from('release_items').delete().eq('release_id', id);
      if (draft.itemIds.length) removed = removed.not('item_id', 'in', `(${draft.itemIds.join(',')})`);
      const { error: removeError } = await removed;
      if (removeError) throw removeError;
      if (draft.itemIds.length) {
        const rows = draft.itemIds.map((itemId, i) => ({ release_id: id, bar_id: barId, item_id: itemId, sort_order: i }));
        const { error } = await supabase.from('release_items').upsert(rows, { onConflict: 'release_id,item_id' });
        if (error) throw error;
      }

      if (publishedAt !== undefined) {
        const { error } = await supabase.from('releases').update({ published_at: publishedAt }).eq('id', id);
        if (error) throw error;
      }
      return id;
    },
    // Returned so mutateAsync waits for the fresh list.
    onSettled: () =>
      Promise.all([client.invalidateQueries({ queryKey: ['venue-releases', barId] }), client.invalidateQueries({ queryKey: ['published'] })]),
  });
}

export function useDeleteRelease(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('releases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['venue-releases', barId] });
      client.invalidateQueries({ queryKey: ['published'] });
    },
  });
}
