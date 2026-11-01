// The browser's IndexedDB, as one object store ("files") in one database. In
// IndexedDB, not localStorage: localStorage holds about 5 MB for everything.
// Values are stored as objects, so reading one back parses nothing. Keep the
// version at 1: a page still running older code would fail to open a newer one.

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('cocktail', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/** Runs one request against the "files" store and closes the database after. */
export function inStore<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = use(db.transaction('files', mode).objectStore('files'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).finally(() => db.close())
  );
}

/** Every key that starts with `prefix`, in key order. */
export const prefixRange = (prefix: string) => IDBKeyRange.bound(prefix, `${prefix}￿`);
