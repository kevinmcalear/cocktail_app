import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { create } from 'zustand';

import { allRowsById, byName, withRow } from '@/lib/allRows';
import { readSavedCatalog, saveCatalog } from '@/lib/catalogFile';
import type { CatalogItem } from '@/lib/match';
import { CATALOG_FRESH_MS, CATALOG_RANGES, packCatalog, unpackCatalog } from '@/lib/matchCatalog';
import { DROPDOWNS_QUERY_KEY } from '@/lib/queryDefaults';
import { supabase } from '@/lib/supabase';

const SAVED_KEY = ['match-catalog', 'saved'] as const;
const SHARED_KEY = ['match-catalog', 'shared'] as const;
/** Under the ingredient list's key, so a save that adds a venue's bottle (refreshIngredients) reads these again. */
const OWN_KEY = [...DROPDOWNS_QUERY_KEY, 'ingredients', 'match-own'] as const;

/** How many of the shared catalog's ranges have arrived, for the Reading screen's progress. */
const useDownloaded = create<{ ranges: number }>(() => ({ ranges: 0 }));

type Row = { id: string | null; name: string | null; generic_id: string | null; bar_id?: string | null };

const toItems = (rows: Row[]): CatalogItem[] =>
  rows.flatMap((r) => (r.id && r.name ? [{ id: r.id, name: r.name, genericId: r.generic_id, barId: r.bar_id ?? null }] : []));

/**
 * Every shared ingredient, just what matching reads (id, name, kind): the
 * id ranges side by side, each a page at a time. Stops when nobody waits
 * on it any more (`signal`).
 */
async function downloadShared(signal: AbortSignal): Promise<CatalogItem[]> {
  useDownloaded.setState({ ranges: 0 });
  const parts = await Promise.all(
    CATALOG_RANGES.map(({ lo, hi }) =>
      allRowsById<Row & { id: string }>((after, size) => {
        let page = supabase.from('app_item_presentation').select('id, name, generic_id').eq('item_type', 'ingredient').is('bar_id', null).gte('id', lo);
        if (hi) page = page.lt('id', hi);
        if (after) page = page.gt('id', after);
        return page.order('id').limit(size).abortSignal(signal);
      }).then((rows) => {
        useDownloaded.setState((s) => ({ ranges: s.ranges + 1 }));
        return rows;
      })
    )
  );
  return toItems(parts.flat()).sort(byName);
}

/**
 * After shared ingredients are saved or made here (refreshIngredients):
 * those rows put into the loaded and saved catalog, so the next snap
 * matches them without waiting a day for a new download.
 */
export const hasMatchCatalog = (client: QueryClient) => [SAVED_KEY, SHARED_KEY].some((key) => !!client.getQueryData(key));

export function patchMatchCatalog(client: QueryClient, ids: string[], rows: Row[]) {
  for (const key of [SAVED_KEY, SHARED_KEY]) {
    const items = client.getQueryData<CatalogItem[] | null>(key);
    if (!items) continue;
    const next = ids.reduce((list, id) => {
      const row = rows.find((r) => r.id === id);
      return withRow(list, id, row && !row.bar_id ? (toItems([row])[0] ?? null) : null);
    }, items);
    client.setQueryData(key, next);
    void saveCatalog(packCatalog(next, Date.now()));
  }
}

/**
 * What Bring in, the bottle photo and the swap match names against: the
 * shared catalog (~20,000 ingredients) plus the venues' own you can see. The
 * shared part is saved on the phone for a day (lib/catalogFile.ts), so a
 * snapped bottle matches at once after the first time; the venues' own are
 * read each time (a few hundred). `progress`: 0 to 1 while the shared part
 * downloads, else null.
 */
export function useMatchCatalog(enabled = true) {
  const client = useQueryClient();
  const saved = useQuery({
    queryKey: SAVED_KEY,
    enabled,
    meta: { persist: false },
    // Read again after a day, so a phone left open still gets new bottles.
    staleTime: CATALOG_FRESH_MS,
    queryFn: async () => {
      const file = unpackCatalog(await readSavedCatalog());
      return file && Date.now() - file.savedAt < CATALOG_FRESH_MS ? file.items : null;
    },
  });
  const live = useQuery({
    queryKey: SHARED_KEY,
    enabled: enabled && saved.isFetched && !saved.data,
    meta: { persist: false },
    staleTime: CATALOG_FRESH_MS,
    queryFn: async ({ signal }) => {
      const items = await downloadShared(signal);
      void saveCatalog(packCatalog(items, Date.now()));
      // The file is fresh now: the next visit reads it rather than downloading again.
      client.setQueryData(SAVED_KEY, items);
      return items;
    },
  });
  const own = useQuery({
    queryKey: OWN_KEY,
    enabled,
    meta: { persist: false },
    queryFn: async ({ signal }) =>
      toItems(
        await allRowsById<Row & { id: string }>((after, size) => {
          const page = supabase.from('app_item_presentation').select('id, name, generic_id, bar_id').eq('item_type', 'ingredient').not('bar_id', 'is', null);
          return (after ? page.gt('id', after) : page).order('id').limit(size).abortSignal(signal);
        })
      ).sort(byName),
  });
  const shared = live.data ?? saved.data ?? null;
  // Shared first, then the venues' own: matching ranks a venue's copy over a shared one of the same name.
  const catalog = useMemo(() => (shared && own.data ? (own.data.length ? [...shared, ...own.data] : shared) : []), [shared, own.data]);
  const ranges = useDownloaded((s) => s.ranges);
  return {
    catalog,
    isLoading: enabled && (!shared || !own.data),
    failed: live.isError || own.isError,
    progress: !shared && live.isFetching ? ranges / CATALOG_RANGES.length : null,
  };
}
