import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { StoredPart } from '@/lib/drinkParts';
import type { Snapshot } from '@/lib/specDiff';
import { jsonAs, supabase } from '@/lib/supabase';

export interface ItemVersion {
  version: number;
  snapshot: Snapshot;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

/** A drink's versions, newest first. Empty until the first save through save_drink_spec, or below the specs capability. */
export function useItemVersions(itemId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['item-versions', itemId],
    enabled: !!itemId && enabled,
    queryFn: async (): Promise<ItemVersion[]> => {
      const { data, error } = await supabase
        .from('item_versions')
        .select('version, snapshot, note, created_by, created_by_name, created_at')
        .eq('item_id', itemId!)
        .order('version', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((v) => ({ ...v, snapshot: jsonAs<ItemVersion['snapshot']>(v.snapshot) }));
    },
  });
}

/**
 * A drink's versions as someone outside its venue sees them, newest first:
 * only when the bar shows spec changes and the drink's spec is public, cut
 * down to what the public spec shows (no notes, no names). Empty otherwise.
 */
export function usePublicSpecChanges(itemId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['public-spec-changes', itemId],
    enabled: !!itemId && enabled,
    queryFn: async (): Promise<ItemVersion[]> => {
      const { data, error } = await supabase.rpc('public_spec_changes', { p_item: itemId! });
      if (error) throw error;
      return (data ?? []).map((v) => ({ ...v, snapshot: jsonAs<Snapshot>(v.snapshot), note: null, created_by: null, created_by_name: null }));
    },
  });
}

/** Put an old version back as a new one. */
export function useRestoreVersion(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) => {
      const { data, error } = await supabase.rpc('restore_drink_version', { p_item: itemId, p_version: version });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['item-versions', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] });
      void queryClient.invalidateQueries({ queryKey: ['cocktails'] });
    },
  });
}

/** A type, not an interface, so the lines pass as Json. */
export type SpecLineInput = {
  id?: string | null;
  ingredient_item_id: string;
  amount: number | null;
  unit: string | null;
  preparation_notes: string | null;
  is_optional: boolean;
  /** Floated on top ("15 ml float", Eddie tf-060). Left out, a kept line keeps what it had. */
  is_float?: boolean;
  /** Made in parts: which part (1 is the first). Left out, a kept line keeps its part. */
  part?: number;
};

/**
 * The editor's save: lines and methods (in order) in one transaction, versioned. Returns the version number.
 * `parts` (a drink made in parts, 20261123100000) gives each method its part and the parts' names; left out, the drink keeps its parts.
 */
export async function saveDrinkSpec(itemId: string, lines: SpecLineInput[], methodIds: string[], note: string | null, parts?: { methodParts: number[]; parts: StoredPart[] }): Promise<number> {
  const { data, error } = await supabase.rpc('save_drink_spec', { p_item: itemId, p_lines: lines, p_method_ids: methodIds, p_note: note, ...(parts ? { p_method_parts: parts.methodParts, p_parts: parts.parts } : {}) });
  if (error) throw error;
  return data as number;
}

export interface ItemComment {
  id: string;
  version: number | null;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string | null;
}

/** The team's notes on a drink at its venue, oldest first. */
export function useItemComments(itemId: string | null | undefined, barId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['item-comments', itemId],
    enabled: !!itemId && !!barId && enabled,
    queryFn: async (): Promise<ItemComment[]> => {
      const { data, error } = await supabase
        .from('item_comments')
        .select('id, version, author_id, author_name, body, created_at, updated_at')
        .eq('item_id', itemId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as ItemComment[];
    },
  });
}

export function useAddComment(itemId: string, barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, version }: { body: string; version: number | null }) => {
      const { error } = await supabase.from('item_comments').insert({ item_id: itemId, bar_id: barId, body: body.trim(), version });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['item-comments', itemId] }),
  });
}

export function useDeleteComment(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('item_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['item-comments', itemId] }),
  });
}
