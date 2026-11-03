import { useQuery } from '@tanstack/react-query';

import { askableIds } from '@/lib/sketch/sketchIds';
import { readSketchInputs, type SketchInputs } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

// A drink's drawing inputs (item_sketches, supabase/migrations/20261006300000_item_sketches.sql),
// for the sketch DrinkImage draws when there's no photo. Row shapes are
// written by hand until types/ is regenerated.

const CHUNK = 100;
type Result = Map<string, SketchInputs | null>;
let pending: { ids: Set<string>; result: Promise<Result> } | null = null;

async function fetchMany(all: string[]): Promise<Map<string, SketchInputs | null>> {
  const out = new Map<string, SketchInputs | null>();
  // Beer and wine ids aren't uuids and would fail the whole batch; they have no drawing row (null).
  const ids = askableIds(all);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.from('item_sketches').select('item_id, inputs').in('item_id', ids.slice(i, i + CHUNK));
    // A failed read is an error, never a cached null: the cache is saved between launches, and offline would overwrite good drawings.
    if (error) throw error;
    for (const row of (data ?? []) as { item_id: string; inputs: unknown }[]) out.set(row.item_id, readSketchInputs(row.inputs));
  }
  return out;
}

/** Every tile asking in the same tick shares one request. */
function load(id: string): Promise<SketchInputs | null> {
  if (!pending) {
    const ids = new Set<string>();
    const result = new Promise<Result>((resolve, reject) => {
      setTimeout(() => {
        pending = null;
        fetchMany([...ids]).then(resolve, reject);
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
