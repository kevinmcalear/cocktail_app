import * as FileSystem from 'expo-file-system/legacy';

/**
 * Plain JSON values saved on this phone, one file each, in a folder of the
 * app's documents (not caches: iOS may empty caches behind the bar). The web
 * build keeps the same values in IndexedDB (lib/fileStore.web.ts). Reads
 * never throw: a missing or unreadable file is null.
 */
export interface FileStore {
  read(name: string): Promise<unknown>;
  write(name: string, value: unknown): Promise<void>;
  remove(name: string): Promise<void>;
  names(): Promise<string[]>;
  clear(): Promise<void>;
}

const made = new Map<string, Promise<unknown>>();

export function fileStore(folder: string): FileStore {
  const dir = `${FileSystem.documentDirectory}${folder}/`;
  const ready = () => {
    if (!made.has(dir)) made.set(dir, FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined));
    return made.get(dir)!;
  };
  const path = (name: string) => `${dir}${encodeURIComponent(name)}.json`;
  // One write at a time per file, each to a side file first and then moved
  // over, so an app killed mid-write leaves the last whole file.
  const writing = new Map<string, Promise<void>>();

  const readFile = async (uri: string) => JSON.parse(await FileSystem.readAsStringAsync(uri)) as unknown;

  return {
    read: async (name) => {
      await writing.get(name);
      try {
        return await readFile(path(name));
      } catch {
        // Killed between removing the old file and moving the new one in.
        return readFile(`${path(name)}.next`).catch(() => null);
      }
    },
    write: (name, value) => {
      const next = (writing.get(name) ?? Promise.resolve()).then(async () => {
        await ready();
        const to = path(name);
        await FileSystem.writeAsStringAsync(`${to}.next`, JSON.stringify(value));
        await FileSystem.deleteAsync(to, { idempotent: true });
        await FileSystem.moveAsync({ from: `${to}.next`, to });
      });
      const done = next.catch((e) => console.warn('Saving to this phone failed', e));
      writing.set(name, done);
      return done;
    },
    remove: async (name) => {
      await writing.get(name);
      await FileSystem.deleteAsync(path(name), { idempotent: true }).catch(() => undefined);
    },
    names: async () => {
      const files = await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[]);
      return files.filter((f) => f.endsWith('.json')).map((f) => decodeURIComponent(f.slice(0, -'.json'.length)));
    },
    clear: async () => {
      await Promise.all(writing.values());
      await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => undefined);
      made.delete(dir);
    },
  };
}
