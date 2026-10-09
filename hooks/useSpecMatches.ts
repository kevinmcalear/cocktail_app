import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { versionLabel, type SpecNote } from '@/lib/servedAt';
import { supabase } from '@/lib/supabase';

export type SpecMatch = 'same' | 'unlisted' | 'variation' | 'riff';

export interface SpecMatchRow {
  item_id: string;
  classic_id: string;
  spec_match: SpecMatch;
  notes: SpecNote;
}

/** public.spec_matches for up to 500 drinks; nothing on a server without the function yet. */
async function fetchSpecMatches(ids: string[]): Promise<SpecMatchRow[]> {
  const { data, error } = await supabase.rpc('spec_matches', { p_item_ids: ids.slice(0, 500) });
  if (error) {
    if (error.code === 'PGRST202') return [];
    throw error;
  }
  return (data ?? []) as SpecMatchRow[];
}

/** A short, stable name for a set of ids, so the cache key doesn't carry hundreds of them. */
function idsKey(ids: string[]): string {
  let h = 5381;
  for (const id of [...ids].sort()) for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return `${ids.length}:${(h >>> 0).toString(36)}`;
}

/**
 * Whether each of these bar versions of a classic is the classic itself, a
 * variation (and what it changes) or a riff, as this person sees the spec
 * (public.spec_matches, supabase/migrations/20261010610000_spec_match.sql).
 * `key` names the set (a classic's id, a search) for the cache.
 */
export function useSpecMatches(key: string | undefined, ids: string[]) {
  return useQuery({
    queryKey: ['spec-matches', key, idsKey(ids)],
    enabled: !!key && ids.length > 0,
    // ponytail: the function reads 500 drinks a call; past that, the first 500's verdicts.
    queryFn: async (): Promise<Record<string, SpecMatchRow>> => Object.fromEntries((await fetchSpecMatches(ids)).map((r) => [r.item_id, r])),
  });
}

// One drink's verdict at a time, asked for by each row of a long list (Discover's
// sheet draws only the rows on screen). Asks made within a moment go as one call.
let waiting: { ids: Set<string>; done: Promise<Map<string, SpecMatchRow>> } | null = null;

function askBatched(id: string): Promise<SpecMatchRow | null> {
  if (!waiting) {
    const ids = new Set<string>();
    const done = new Promise<Map<string, SpecMatchRow>>((resolve, reject) => {
      setTimeout(() => {
        waiting = null;
        fetchSpecMatches([...ids]).then((rows) => resolve(new Map(rows.map((r) => [r.item_id, r]))), reject);
      }, 10);
    });
    waiting = { ids, done };
  }
  waiting.ids.add(id);
  return waiting.done.then((m) => m.get(id) ?? null);
}

/** What a bar's drink is to its classic ("the classic spec", or what its variation changes), for a row. */
export function useVersionLabel(itemId: string | undefined) {
  const { data } = useQuery({
    queryKey: ['spec-match', itemId],
    enabled: !!itemId,
    queryFn: () => askBatched(itemId!),
  });
  return versionLabel(data);
}

/**
 * For a classic's "Best X" list, which is one row per bar: what each bar pours
 * of it, by the bar's profile id. A bar with the classic's own spec reads
 * "the classic spec" even if it also pours a variation.
 */
export function useBarVersionLabels(classicId: string | undefined, profileIds: string[]) {
  const { data } = useQuery({
    queryKey: ['bar-version-labels', classicId, idsKey(profileIds)],
    enabled: !!classicId && profileIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data: versions, error } = await supabase
        .from('items')
        .select('id, origin_bar_profile_id')
        .eq('riff_of_id', classicId!)
        .in('origin_bar_profile_id', profileIds.slice(0, 200));
      if (error) throw error;
      const rows = (versions ?? []) as { id: string; origin_bar_profile_id: string }[];
      if (!rows.length) return {};
      const matches = new Map((await fetchSpecMatches(rows.map((r) => r.id))).map((m) => [m.item_id, m]));
      const labels: Record<string, string> = {};
      for (const r of rows) {
        const label = versionLabel(matches.get(r.id));
        if (!label) continue;
        if (label === 'the classic spec' || !labels[r.origin_bar_profile_id]) labels[r.origin_bar_profile_id] = label;
      }
      return labels;
    },
  });
  return data ?? {};
}

/** An editor's call on their drink: "same" as the classic, "variation", or null to go back to the worked-out verdict. */
export function useSetSpecMatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, specMatch }: { itemId: string; specMatch: 'same' | 'variation' | null }) => {
      const { error } = await supabase.rpc('set_spec_match', { p_item_id: itemId, p_spec_match: specMatch });
      if (error) throw error;
    },
    onSettled: () => {
      for (const key of ['spec-match', 'spec-matches', 'bar-version-labels', 'home-bar']) void client.invalidateQueries({ queryKey: [key] });
    },
  });
}
