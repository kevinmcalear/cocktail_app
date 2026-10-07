import { useQuery } from '@tanstack/react-query';

import { readSketchInputs, type SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

// A drink's drawing inputs (item_sketches, supabase/migrations/20261006300000_item_sketches.sql),
// for the sketch DrinkImage draws when there's no photo. Row shapes are
// written by hand until types/ is regenerated.

const CHUNK = 100;
let pending: { ids: Set<string>; result: Promise<Map<string, SketchInputs | null>> } | null = null;

async function fetchMany(ids: string[]): Promise<Map<string, SketchInputs | null>> {
  const out = new Map<string, SketchInputs | null>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.from('item_sketches').select('item_id, inputs').in('item_id', ids.slice(i, i + CHUNK));
    // Decorative: signed out, or not readable, the drink falls back to its glass icon.
    if (error) continue;
    for (const row of (data ?? []) as { item_id: string; inputs: unknown }[]) out.set(row.item_id, readSketchInputs(row.inputs));
  }
  return out;
}

/** Every tile asking in the same tick shares one request. */
function load(id: string): Promise<SketchInputs | null> {
  if (!pending) {
    const ids = new Set<string>();
    const result = new Promise<Map<string, SketchInputs | null>>((resolve) => {
      setTimeout(() => {
        pending = null;
        fetchMany([...ids]).then(resolve, () => resolve(new Map()));
      }, 16);
    });
    pending = { ids, result };
  }
  pending.ids.add(id);
  return pending.result.then((m) => m.get(id) ?? null);
}

/** A drink's drawing inputs, or null when it has none yet (or isn't a cocktail). Pass null to skip. */
export function useItemSketch(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['item-sketch', itemId],
    enabled: !!itemId,
    staleTime: 10 * 60_000,
    queryFn: () => load(itemId!),
  });
}
