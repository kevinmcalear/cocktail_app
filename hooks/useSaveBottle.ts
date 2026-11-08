import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { BAR_WRITES, type BottleWrite } from '@/hooks/barWrites';
import { saveIngredientPicture } from '@/hooks/ingredientPicture';
import { useBackBarParts } from '@/hooks/useBackBar';
import { useSwapSource } from '@/hooks/useBulk';
import { refreshIngredients } from '@/hooks/useDropdowns';
import { useShelf } from '@/hooks/useHomeBar';
import { recentEntry } from '@/hooks/useTrackRecent';
import { supabase } from '@/lib/supabase';
import { toastDone } from '@/lib/toast';
import { useRecentActivityStore } from '@/store/useRecentActivityStore';

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

export interface SaveBottleInput extends BottleWrite {
  /** The label photo, kept as a new bottle's picture. */
  photo: string | null;
  /** Saved with no signal (Save on this phone): it says so when it's in, wherever you are by then. */
  queued: boolean;
}

/**
 * Saves a bottle you buy (hooks/barWrites.ts sends it). With no signal it
 * waits on the phone, survives the app closing and sends when there's signal
 * again. Then the label photo (a new bottle's only), and the pickers learn it.
 */
export function useSaveBottle() {
  const qc = useQueryClient();
  const write = BAR_WRITES.bottle;
  return useMutation({
    mutationKey: write.key,
    mutationFn: (w: SaveBottleInput) => write.send(w),
    onSuccess: async (id, w) => {
      useRecentActivityStore.getState().push(recentEntry('ingredient', id, w.name, { barId: w.barId }));
      void refreshIngredients(qc, [id]).catch(() => {});
      if (w.queued) toastDone('Bottle saved', w.name);
      // ponytail: a photo waiting with a save cut short by closing the app is lost (the bottle isn't); keep the file and resend it if that matters.
      // Only a bottle made here: one the database said was already shared keeps its own picture.
      if (w.photo && !w.existing && id === w.id) {
        await saveIngredientPicture(qc, id, 'photo', w.photo).catch(() => Alert.alert('The label photo didn’t save', 'The bottle is saved. Add the photo again on its page.'));
      }
    },
    onSettled: (_id, _error, w) => {
      for (const queryKey of write.refresh(w)) void qc.invalidateQueries({ queryKey });
    },
    // The screen says what went wrong itself and keeps what's typed; a save that waited for signal lands after it closed, so that one is said here.
    onError: (e, w) => {
      if (w.queued) Alert.alert(`Couldn’t save ${w.name}`, e.message);
    },
  });
}
