import { useMemo } from 'react';

import { useSearchNear } from '@/hooks/useSearchNear';

const INGREDIENT = ['ingredient'] as const;

type Row = { id: string; name: string | null; hide_from_search?: boolean | null };

/**
 * The ingredients an ingredient picker may have meant ("chartruse": Green
 * Chartreuse), closest first, from the picker's own list: `first` (a plural
 * or a slip the picker found itself, as nearIngredient does), then what
 * public.search_near finds among the shared ones. Rows already shown, hidden
 * from search or not in the list are left out. Off with `skip` (the name is
 * one already).
 */
export function useNearIngredients<T extends Row>(query: string, rows: readonly T[], { skip = false, shown = [], first = null, limit = 3 }: { skip?: boolean; shown?: readonly T[]; first?: T | null; limit?: number } = {}): T[] {
  const { data: hits } = useSearchNear(query, { kinds: INGREDIENT, enabled: !skip });
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  if (skip) return [];
  const seen = new Set(shown.map((r) => r.id));
  const out: T[] = [];
  for (const r of [first, ...(hits ?? []).map((h) => byId.get(h.id))]) {
    if (!r || r.hide_from_search || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.slice(0, limit);
}
