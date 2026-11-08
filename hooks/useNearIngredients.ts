import { useEffect, useMemo, useState } from 'react';

import { useSearchNear } from '@/hooks/useSearchNear';

const INGREDIENT = ['ingredient'] as const;
/** How long after the last letter a picker waits on the database before saying "not there" anyway (slow or no network). */
const NEAR_WAIT_MS = 1500;

type Row = { id: string; name: string | null; hide_from_search?: boolean | null };

/**
 * The ingredients an ingredient picker may have meant ("chartruse": Green
 * Chartreuse), closest first, from the picker's own list: `first` (a plural
 * or a slip the picker found itself, as nearIngredient does), then what
 * public.search_near finds among the shared ones. Rows already shown, hidden
 * from search or not in the list are left out. Off with `skip` (the name is
 * one already).
 */
export function useNearIngredients<T extends Row>(query: string, rows: readonly T[], options: NearOptions<T> = {}): T[] {
  return useNearIngredientsChecked(query, rows, options).near;
}

type NearOptions<T> = { skip?: boolean; shown?: readonly T[]; first?: T | null; limit?: number };

/**
 * useNearIngredients, and `checking` while the database hasn't answered for
 * what's typed (NEAR_WAIT_MS at most), so a picker says "Looking…", not
 * "No bottle by that name", before it knows (Mat, 4 Nov).
 */
export function useNearIngredientsChecked<T extends Row>(query: string, rows: readonly T[], { skip = false, shown = [], first = null, limit = 3 }: NearOptions<T> = {}): { near: T[]; checking: boolean } {
  const { data: hits, asking } = useSearchNear(query, { kinds: INGREDIENT, enabled: !skip });
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const [gaveUp, setGaveUp] = useState<string | null>(null);
  // A new query clears the last one's give-up, so typing the same miss again says "Looking…" again.
  if (gaveUp !== null && gaveUp !== query) setGaveUp(null);
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setGaveUp(query), NEAR_WAIT_MS);
    return () => clearTimeout(t);
  }, [asking, query]);
  if (skip) return { near: [], checking: false };
  const seen = new Set(shown.map((r) => r.id));
  const out: T[] = [];
  for (const r of [first, ...(hits ?? []).map((h) => byId.get(h.id))]) {
    if (!r || r.hide_from_search || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return { near: out.slice(0, limit), checking: !!asking && gaveUp !== query };
}
