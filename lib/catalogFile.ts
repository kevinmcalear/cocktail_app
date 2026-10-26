import * as FileSystem from 'expo-file-system/legacy';

import type { SavedCatalog } from '@/lib/matchCatalog';

// In the cache folder: the system may clear it, and then it's downloaded again.
const FILE = `${FileSystem.cacheDirectory}match-catalog-v1.json`;

/**
 * The shared catalog saved on this phone (lib/matchCatalog.ts), or null. Its
 * own file, not the query cache: at ~1.4 MB it's near the size Android
 * can't read back from one storage row (lib/queryCachePersist.ts). Shared
 * rows only, the same for everyone, so it isn't cleared at sign-out.
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
}
