import { useQuery, useQueryClient, type Query, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { allRowsById, byName, mergeByName, withRow } from '@/lib/allRows';
import { readSavedCatalog, saveCatalog } from '@/lib/catalogFile';
import { useDownloading } from '@/lib/catalogProgress';
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
/** When this launch (or web page load) began: a saved copy of OWN_KEY from before it is read again. */
const LAUNCHED = Date.now();

type Shared = { savedAt: number; rows: CatalogRow[] };

/** Bumped when a saved bottle goes into the loaded catalog, so a download begun before it doesn't drop it. */
let patched = 0;

/** The background download is its own chunk: pages that only read a saved catalog (a public drink) never load it. */
async function refresh(client: QueryClient) {
  const { refreshShared } = await import('@/lib/catalogDownload');
  refreshShared(client, SHARED_KEY, () => patched);
}

let merged: { shared: CatalogRow[]; own: CatalogRow[]; rows: CatalogRow[] } | undefined;

/** Shared and own as one name-sorted list, the same array for every picker (lib/ingredientNames indexes each array once). */
function wholeList(shared: CatalogRow[], own: CatalogRow[]): CatalogRow[] {
  if (merged?.shared !== shared || merged.own !== own) merged = { shared, own, rows: own.length ? mergeByName(shared, own) : shared };
  return merged.rows;
}

/**
 * Every ingredient you can pick (~20,000), just what pickers and matching
 * read (CATALOG_COLUMNS): the shared catalog, saved on the device (lib/catalogFile.ts)
 * so a picker opens at once after the first time, and downloaded again
 * behind it once it's a day old, plus the venues' own and yours (a few
 * hundred), saved too and read again each time. `rows` is both in name
 * order, undefined until both are here.
 */
export function useIngredientCatalog(enabled = true) {
  const client = useQueryClient();
  const shared = useQuery({
    queryKey: SHARED_KEY,
    enabled,
    meta: { persist: false },
    // Fresh until a day after it was downloaded, however recently the file was read.
    staleTime: (q: Query<Shared>) => (q.state.data ? q.state.data.savedAt + CATALOG_FRESH_MS - q.state.dataUpdatedAt : 0),
    queryFn: async ({ signal }): Promise<Shared> => {
      // Loaded and a day old (or the last download failed): search it while a new one downloads, without reading the file again.
      const held = client.getQueryData<Shared>(SHARED_KEY);
      if (held) {
        if (Date.now() - held.savedAt >= CATALOG_FRESH_MS) void refresh(client);
        return held;
      }
      const file = unpackCatalog(await readSavedCatalog());
      if (file) {
        // A day old, it's still what the pickers search while the new one downloads (Mat, 4 Nov: waiting on it read as a slow search).
        if (Date.now() - file.savedAt >= CATALOG_FRESH_MS) void refresh(client);
        // A copy downloaded since this read began is newer than the file it hasn't saved over yet.
        const loaded = client.getQueryData<Shared>(SHARED_KEY);
        return loaded && loaded.savedAt > file.savedAt ? loaded : file;
      }
      const rows = await (await import('@/lib/catalogDownload')).downloadShared(signal);
      const savedAt = Date.now();
      void saveCatalog(packCatalog(rows, savedAt));
      return { savedAt, rows };
    },
  });
  const own = useQuery({
    queryKey: OWN_KEY,
    enabled,
    // Saved in a file (lib/queryCachePersist.ts), so a picker searches at once and reads them again behind it.
    meta: { persist: true },
    // A copy saved by an earlier launch (or reload) is read again behind it, once: it can predate a bottle saved
    // here or by a teammate. Read this launch, it's fresh for a day, and a save (refreshIngredients) reads it again.
    staleTime: (q: Query<CatalogRow[]>) => (q.state.dataUpdatedAt < LAUNCHED ? 0 : CATALOG_FRESH_MS),
    // No abort signal: a read a save started finishes and is saved even when its screen closes first (TanStack
    // cancels and reverts a read that took the signal once nothing watches it, which kept the copy from before).
    queryFn: async () =>
      (
        await allRowsById<CatalogRow>((after, size) => {
          const page = supabase.from('app_item_presentation').select(CATALOG_COLUMNS).eq('item_type', 'ingredient').or('bar_id.not.is.null,created_by.not.is.null,origin_bar_profile_id.not.is.null');
          return (after ? page.gt('id', after) : page).order('id').limit(size);
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
  // A download that landed during the read is the list to patch.
  const base = client.getQueryData<Shared>(SHARED_KEY) ?? data;
  patched++;
  const next = ids.reduce((list, id) => {
    const found = rows.find((r) => r.id === id);
    if (!found) return withRow(list, id, null);
    const { created_by, origin_bar_profile_id, ...row } = found;
    return withRow(list, id, row.bar_id || created_by || origin_bar_profile_id ? null : row);
  }, base.rows);
  if (client.getQueryData(SHARED_KEY)) client.setQueryData<Shared>(SHARED_KEY, { ...base, rows: next });
  await saveCatalog(packCatalog(next, base.savedAt));
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
