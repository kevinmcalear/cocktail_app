import { useQuery, type Query, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { create } from 'zustand';

import { allRowsById, byName, mergeByName, withRow } from '@/lib/allRows';
import { readSavedCatalog, saveCatalog } from '@/lib/catalogFile';
import { CATALOG_COLUMNS, CATALOG_FRESH_MS, CATALOG_RANGES, packCatalog, toItems, unpackCatalog, type CatalogRow } from '@/lib/matchCatalog';
import { DROPDOWNS_QUERY_KEY } from '@/lib/queryDefaults';
import { supabase } from '@/lib/supabase';

/**
 * The shared catalog: outside the ingredient list's key, so a save that
 * refreshes ingredients never downloads it again (refreshIngredients puts
 * the changed rows in instead).
 */
const SHARED_KEY = ['ingredient-catalog', 'shared'] as const;
/** Under the ingredient list's key, so a save that adds a venue's bottle or your own (refreshIngredients) reads these again. */
const OWN_KEY = [...DROPDOWNS_QUERY_KEY, 'ingredients', 'own'] as const;

type Shared = { savedAt: number; rows: CatalogRow[] };

/** How many of the shared catalog's ranges have arrived while it downloads (null when it isn't), for the Reading screen's progress. */
const useDownloading = create<{ ranges: number | null }>(() => ({ ranges: null }));

/**
 * Every shared ingredient (no venue's, nobody's own, none from a bar's page:
 * who sees those depends on who's looking, so one copy suits everyone): the
 * id ranges side by side, each a page at a time. Stops when nobody waits on
 * it any more (`signal`), and all of it stops when one range fails.
 */
async function downloadShared(signal: AbortSignal): Promise<CatalogRow[]> {
  useDownloading.setState({ ranges: 0 });
  const stop = new AbortController();
  signal.addEventListener('abort', () => stop.abort());
  try {
    const parts = await Promise.all(
      CATALOG_RANGES.map(({ lo, hi }) =>
        allRowsById<CatalogRow>((after, size) => {
          let page = supabase.from('app_item_presentation').select(CATALOG_COLUMNS).eq('item_type', 'ingredient').is('bar_id', null).is('created_by', null).is('origin_bar_profile_id', null).gte('id', lo);
          if (hi) page = page.lt('id', hi);
          if (after) page = page.gt('id', after);
          return page.order('id').limit(size).abortSignal(stop.signal);
        }).then(
          (rows) => {
            useDownloading.setState((s) => ({ ranges: (s.ranges ?? 0) + 1 }));
            return rows;
          },
          (error: unknown) => {
            stop.abort();
            throw error;
          }
        )
      )
    );
    return parts.flat().sort(byName);
  } finally {
    useDownloading.setState({ ranges: null });
  }
}

let merged: { shared: CatalogRow[]; own: CatalogRow[]; rows: CatalogRow[] } | undefined;

/** Shared and own as one name-sorted list, the same array for every picker (lib/ingredientNames indexes each array once). */
function wholeList(shared: CatalogRow[], own: CatalogRow[]): CatalogRow[] {
  if (merged?.shared !== shared || merged.own !== own) merged = { shared, own, rows: own.length ? mergeByName(shared, own) : shared };
  return merged.rows;
}

/**
 * Every ingredient you can pick (~20,000), just what pickers and matching
 * read (CATALOG_COLUMNS): the shared catalog, saved on the device for a day
 * (lib/catalogFile.ts) so a picker opens at once after the first time, plus
 * the venues' own and yours, read each time (a few hundred). `rows` is both
 * in name order, undefined until both are here.
 */
export function useIngredientCatalog(enabled = true) {
  const shared = useQuery({
    queryKey: SHARED_KEY,
    enabled,
    meta: { persist: false },
    // Fresh until a day after it was downloaded, however recently the file was read.
    staleTime: (q: Query<Shared>) => (q.state.data ? q.state.data.savedAt + CATALOG_FRESH_MS - q.state.dataUpdatedAt : 0),
    queryFn: async ({ signal }): Promise<Shared> => {
      const file = unpackCatalog(await readSavedCatalog());
      if (file && Date.now() - file.savedAt < CATALOG_FRESH_MS) return file;
      const rows = await downloadShared(signal);
      const savedAt = Date.now();
      void saveCatalog(packCatalog(rows, savedAt));
      return { savedAt, rows };
    },
  });
  const own = useQuery({
    queryKey: OWN_KEY,
    enabled,
    meta: { persist: false },
    queryFn: async ({ signal }) =>
      (
        await allRowsById<CatalogRow>((after, size) => {
          const page = supabase.from('app_item_presentation').select(CATALOG_COLUMNS).eq('item_type', 'ingredient').or('bar_id.not.is.null,created_by.not.is.null,origin_bar_profile_id.not.is.null');
          return (after ? page.gt('id', after) : page).order('id').limit(size).abortSignal(signal);
        })
      ).sort(byName),
  });
  const rows = useMemo(() => (shared.data && own.data ? wholeList(shared.data.rows, own.data) : undefined), [shared.data, own.data]);
  return { rows, shared: shared.data?.rows, own: own.data, error: shared.error ?? own.error };
}

type ReadRow = CatalogRow & { created_by: string | null; origin_bar_profile_id: string | null };

/**
 * After ingredients are saved or made here (refreshIngredients): those rows
 * (`read` when there's a catalog to put them in) go into the loaded and
 * saved shared catalog, or come out when they're gone or no longer shared,
 * without downloading it again. The saved file too when nothing has it
 * loaded, so the next picker doesn't open on the old rows.
 */
export async function patchSharedCatalog(client: QueryClient, ids: string[], read: () => Promise<ReadRow[] | null>) {
  const loaded = client.getQueryData<Shared>(SHARED_KEY);
  const data = loaded ?? unpackCatalog(await readSavedCatalog());
  if (!data) return;
  const rows = await read();
  if (!rows) return;
  const next = ids.reduce((list, id) => {
    const found = rows.find((r) => r.id === id);
    if (!found) return withRow(list, id, null);
    const { created_by, origin_bar_profile_id, ...row } = found;
    return withRow(list, id, row.bar_id || created_by || origin_bar_profile_id ? null : row);
  }, data.rows);
  if (client.getQueryData(SHARED_KEY)) client.setQueryData<Shared>(SHARED_KEY, { ...data, rows: next });
  await saveCatalog(packCatalog(next, data.savedAt));
}

/**
 * What Bring in, the bottle photo and the swap match names against: the
 * same catalog as the pickers. `progress`: 0 to 1 while the shared part
 * downloads, else null.
 */
export function useMatchCatalog(enabled = true) {
  const { shared, own, error } = useIngredientCatalog(enabled);
  const ranges = useDownloading((s) => s.ranges);
  // Every bar-less row by name, then the venues' own: matching ranks a venue's copy over a shared one of
  // the same name, and this is the order the server's shortlist comes in (lib/matchCatalog.ts shortlistCatalog).
  const catalog = useMemo(() => {
    if (!shared || !own) return [];
    if (!own.length) return toItems(shared);
    return toItems([...mergeByName(shared, own.filter((r) => !r.bar_id)), ...own.filter((r) => r.bar_id)]);
  }, [shared, own]);
  return {
    catalog,
    isLoading: enabled && (!shared || !own),
    failed: !!error,
    progress: !shared && ranges !== null ? ranges / CATALOG_RANGES.length : null,
  };
}
