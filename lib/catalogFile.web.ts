import type { SavedCatalog } from '@/lib/matchCatalog';

// ponytail: the web downloads the catalog once a visit (a few seconds) rather
// than save it: localStorage holds about 5 MB for everything and the query
// cache already uses part of it. IndexedDB is the upgrade.

export async function readSavedCatalog(): Promise<unknown> {
  return null;
}

export async function saveCatalog(_saved: SavedCatalog): Promise<void> {}
