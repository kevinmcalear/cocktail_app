import type { QueryClient } from '@tanstack/react-query';

import { allRowsById, byName } from '@/lib/allRows';
import { saveCatalog } from '@/lib/catalogFile';
import { useDownloading } from '@/lib/catalogProgress';
import { CATALOG_COLUMNS, CATALOG_RANGES, packCatalog, type CatalogRow } from '@/lib/matchCatalog';
import { supabase } from '@/lib/supabase';

// Loaded on demand (import() in hooks/useIngredientCatalog): the download only runs when no fresh saved
// catalog is on the phone, so the public drink and menu pages, which share that hook, don't carry it.

/**
 * Every shared ingredient (no venue's, nobody's own, none from a bar's page:
 * who sees those depends on who's looking, so one copy suits everyone): the
 * id ranges side by side, each a page at a time. Stops when nobody waits on
 * it any more (`signal`), and all of it stops when one range fails.
 */
export async function downloadShared(signal: AbortSignal): Promise<CatalogRow[]> {
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

/** The download behind a day-old saved catalog, so pickers opening together start one. */
let refreshing: Promise<void> | null = null;

/**
 * A new copy of the shared catalog while the pickers read the saved one:
 * swapped in and saved when it lands. A failure keeps the saved one, and the
 * next picker to open tries again. `moved` counts the bottles saved into the
 * loaded list, so a download begun before one doesn't drop it.
 */
export function refreshShared(client: QueryClient, key: readonly unknown[], moved: () => number) {
  if (refreshing) return;
  const since = moved();
  refreshing = downloadShared(new AbortController().signal)
    .then((rows) => {
      // A bottle saved meanwhile is in the loaded list, maybe not in this download: keep that one; the next picker downloads again.
      if (moved() !== since) return;
      const fresh = { savedAt: Date.now(), rows };
      client.setQueryData(key, fresh);
      return saveCatalog(packCatalog(rows, fresh.savedAt));
    })
    .catch(() => undefined)
    .finally(() => {
      refreshing = null;
    });
}
