import type { SavedCatalog } from '@/lib/matchCatalog';

// In IndexedDB, not localStorage: localStorage holds about 5 MB for
// everything and the query cache already uses part of it. Stored as an
// object, so reading it back parses nothing.
const KEY = 'ingredient-catalog-v2';

function inStore<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('cocktail', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  }).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = use(db.transaction('files', mode).objectStore('files'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).finally(() => db.close())
  );
}

/** The shared catalog saved in this browser (lib/matchCatalog.ts), or null (private window, storage blocked). */
export async function readSavedCatalog(): Promise<unknown> {
  return inStore('readonly', (store) => store.get(KEY)).catch(() => null);
}

export async function saveCatalog(saved: SavedCatalog): Promise<void> {
  await inStore('readwrite', (store) => store.put(saved, KEY)).catch(() => undefined);
}
