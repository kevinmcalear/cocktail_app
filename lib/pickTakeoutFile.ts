import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { optionalNative } from '@/lib/optionalNative';

type DocumentPickerModule = typeof import('expo-document-picker');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the native module exists
const documents = Platform.OS === 'web' ? null : optionalNative<DocumentPickerModule>('ExpoDocumentPicker', () => require('expo-document-picker'));

/** Saved Places.json runs to a few MB for someone with thousands of places. */
const MAX_BYTES = 20 * 1024 * 1024;

export const TOO_BIG = 'That file is too big to be a Google Maps export.';
/** Builds before the document picker shipped can't open files. */
export const canPickFiles = Platform.OS === 'web' || !!documents;

/**
 * A Google Maps Takeout file's text, read on this device: Saved Places.json
 * or a saved list's .csv. Null when cancelled. Throws TOO_BIG.
 */
export async function pickTakeoutFile(): Promise<{ name: string; text: string } | null> {
  if (Platform.OS === 'web') {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.csv,application/json,text/csv';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.oncancel = () => resolve(null);
      input.click();
    });
    if (!file) return null;
    if (file.size > MAX_BYTES) throw new Error(TOO_BIG);
    return { name: file.name, text: await file.text() };
  }
  if (!documents) return null;
  // Android's Files often calls an unzipped .json octet-stream; readTakeout turns away anything else.
  const result = await documents.getDocumentAsync({ type: ['application/json', 'text/csv', 'text/comma-separated-values', 'text/plain', ...(Platform.OS === 'android' ? ['application/octet-stream'] : [])], copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const file = result.assets[0];
  if ((file.size ?? 0) > MAX_BYTES) throw new Error(TOO_BIG);
  try {
    return { name: file.name, text: await FileSystem.readAsStringAsync(file.uri) };
  } finally {
    // The picker's copy is the only copy we made: don't leave it in the cache.
    void FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => {});
  }
}
