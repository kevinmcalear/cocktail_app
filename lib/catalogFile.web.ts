import { inStore } from '@/lib/idb.web';
import type { SavedCatalog } from '@/lib/matchCatalog';

// In IndexedDB (lib/idb.web.ts): the query cache already uses part of localStorage's 5 MB.
const KEY = 'ingredient-catalog-v2';

/** The shared catalog saved in this browser (lib/matchCatalog.ts), or null (private window, storage blocked). */
export async function readSavedCatalog(): Promise<unknown> {
  return inStore('readonly', (store) => store.get(KEY)).catch(() => null);
}

export async function saveCatalog(saved: SavedCatalog): Promise<void> {
  await inStore('readwrite', (store) => store.put(saved, KEY)).catch(() => undefined);
}
