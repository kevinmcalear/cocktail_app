import * as FileSystem from 'expo-file-system/legacy';

import type { SavedCatalog } from '@/lib/matchCatalog';

// In the cache folder: the system may clear it, and then it's downloaded again.
const FILE = `${FileSystem.cacheDirectory}ingredient-catalog-v2.json`;
/** The match catalog's names-only file before v2: removed at the next save. */
const OLD_FILE = `${FileSystem.cacheDirectory}match-catalog-v1.json`;

/**
 * The shared catalog saved on this phone (lib/matchCatalog.ts), or null. Its
 * own file, not the query cache: at ~2 MB it's past the size Android can't
 * read back from one storage row (lib/queryCachePersist.ts). Shared rows
 * only (no venue's, nobody's own), the same for everyone, so it isn't
 * cleared at sign-out.
 */
export async function readSavedCatalog(): Promise<unknown> {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(FILE));
  } catch {
    return null;
  }
}

export async function saveCatalog(saved: SavedCatalog): Promise<void> {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(saved)).catch(() => undefined);
  await FileSystem.deleteAsync(OLD_FILE, { idempotent: true }).catch(() => undefined);
}
