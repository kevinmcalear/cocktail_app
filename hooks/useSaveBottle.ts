import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BAR_WRITES, type BottleWrite } from '@/hooks/barWrites';
import { useBackBarParts } from '@/hooks/useBackBar';
import { useSwapSource } from '@/hooks/useBulk';
import { useShelf } from '@/hooks/useShelf';
import { supabase } from '@/lib/supabase';

export type { BottleWrite };

/** Where a bottle already is: on the venue's back bar (since when, in how many of its drinks), or on your shelf. */
export interface BottleHere {
  since: string | null;
  drinks: number;
}

/**
 * Whether a bottle is already where this one would go (Add-bottle, Name
 * taken): the venue's back bar (its stock list, its own bottles, what has a
 * spot, what its specs pour), or your shelf at home. Null when it isn't.
 */
export function useBottleHere(barId: string | null, catalog: readonly { id: string; bar_id?: string | null }[]): (id: string | null | undefined) => BottleHere | null {
  const parts = useBackBarParts(barId, catalog);
  const pours = useSwapSource(barId).data;
  const shelf = useShelf().data;
  return useMemo(() => {
    const shelved = new Set(barId ? [] : (shelf ?? []));
    return (id) => {
      if (!id) return null;
      if (!barId) return shelved.has(id) ? { since: null, drinks: 0 } : null;
      if (!parts.ids.has(id)) return null;
      const drinks = (pours?.drinks ?? []).filter((d) => d.lines.some((l) => l.ingredientId === id)).length;
      return { since: parts.stocked.get(id)?.added_at ?? null, drinks };
    };
  }, [barId, parts, pours, shelf]);
}

/** How strong each of these is (the catalog the pickers read has no strengths): "Laphroaig · 40% · Islay scotch". */
export function useBottleStrengths(ids: readonly string[]): Record<string, number | null> {
  const sorted = [...new Set(ids)].sort();
  return (
    useQuery({
      queryKey: ['bottle-strengths', sorted],
      enabled: sorted.length > 0,
      staleTime: 1000 * 60 * 60,
      queryFn: async (): Promise<Record<string, number | null>> => {
        const { data, error } = await supabase.from('items').select('id, abv').in('id', sorted);
        if (error) throw error;
        return Object.fromEntries((data ?? []).map((r) => [r.id, r.abv === null ? null : Number(r.abv)]));
      },
    }).data ?? {}
  );
}

/**
 * Saves a bottle you buy (hooks/barWrites.ts sends it). With no signal it
 * waits on the phone, survives the app closing and sends when there's signal
 * again. What follows (the label photo, recents, the pickers, a queued one's
 * toast or refusal) runs from the write itself (lib/react-query.ts), so a save
 * resumed after a relaunch does it too.
 */
export function useSaveBottle() {
  const write = BAR_WRITES.bottle;
  return useMutation({ mutationKey: write.key, mutationFn: (w: BottleWrite) => write.send(w) });
}
