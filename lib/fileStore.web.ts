import { inStore, prefixRange } from '@/lib/idb.web';
import type { FileStore } from '@/lib/fileStore';

export type { FileStore } from '@/lib/fileStore';

/**
 * The browser's side of lib/fileStore.ts: each value an IndexedDB entry keyed
 * "folder/name", kept as an object so reading it back parses nothing. A
 * private window or blocked storage reads null and saves nothing.
 */
export function fileStore(folder: string): FileStore {
  const key = (name: string) => `${folder}/${name}`;
  return {
    read: (name) => inStore('readonly', (store) => store.get(key(name))).then((v: unknown) => v ?? null, () => null),
    write: (name, value) => inStore('readwrite', (store) => store.put(value, key(name))).then(() => undefined, () => undefined),
    remove: (name) => inStore('readwrite', (store) => store.delete(key(name))).catch(() => undefined),
    names: () =>
      inStore('readonly', (store) => store.getAllKeys(prefixRange(`${folder}/`))).then(
        (keys) => keys.map((k) => String(k).slice(folder.length + 1)),
        () => []
      ),
    clear: () => inStore('readwrite', (store) => store.delete(prefixRange(`${folder}/`))).catch(() => undefined),
  };
}
