import { Platform } from 'react-native';

import { ensureAiConsent } from '@/lib/aiConsent';
import { isReadableFile, isTextFile } from '@/lib/bringInAnywhere';
import { uriToBase64 } from '@/lib/imageBase64';
import { invokeFunction } from '@/lib/invokeFunction';
import { AI_DECLINED, pickMenuPhotos, takeMenuPhoto, type MenuPhoto } from '@/lib/readMenu';
import type { ReadSource } from '@/lib/bringIn';
import type { AnythingReading, ReadKind } from '@/supabase/functions/_shared/anythingRead';

export type { AnythingReading, ReadKind };

/** A photo or a PDF to read. */
export type ReadFile = MenuPhoto;

export const MAX_READ_FILES = 4;
/** Picked or dropped at once; read four to a call. */
export const MAX_PICK_FILES = 12;

export { isReadableFile, isTextFile };

/** On web (and the desktop shell) a file chooser for photos, PDFs, text and .csv; on native, the photo library. Empty when cancelled. */
export function pickReadFiles(): Promise<ReadFile[]> {
  if (Platform.OS !== 'web') return pickMenuPhotos(MAX_READ_FILES);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,text/plain,text/csv,.txt,.csv,.md';
    input.multiple = true;
    input.onchange = () =>
      resolve(
        Array.from(input.files ?? [])
          .filter((file) => isReadableFile(file.type) || isTextFile(file.type, file.name))
          .slice(0, MAX_PICK_FILES)
          .map((file) => ({ uri: URL.createObjectURL(file), mimeType: file.type || 'text/plain', name: file.name })),
      );
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/** Snap: the camera (on the web, a phone's camera through the file chooser). Empty when cancelled. */
export function snapReadFiles(): Promise<ReadFile[]> {
  if (Platform.OS !== 'web') return takeMenuPhoto();
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(Array.from(input.files ?? []).slice(0, 1).map((file) => ({ uri: URL.createObjectURL(file), mimeType: file.type, name: file.name })));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/**
 * Reads photos, PDFs, text or a link (read-anything): a menu, recipes or bottles,
 * whichever it is. `hint` is the screen the person started from; `as` is what
 * the person says it is (a function deployed before "Reading as" ignores it
 * and goes by the hint, which is then the same). Asks for the Google AI OK first.
 */
export async function readAnything({ files = [], text = '', url, hint, as = null }: { files?: ReadFile[]; text?: string; url?: string; hint: ReadKind | null; as?: ReadKind | null }): Promise<AnythingReading> {
  if (!(await ensureAiConsent())) throw new Error(AI_DECLINED);
  const encoded = await Promise.all(files.slice(0, MAX_READ_FILES).map(async (file) => ({ base64: await uriToBase64(file.uri), mime_type: file.mimeType })));
  return invokeFunction<AnythingReading>('read-anything', { files: encoded, text: text.trim() || undefined, url, hint: as ?? hint, as: as ?? undefined });
}

/** A text or .csv file's contents (web: a blob URL). */
export async function readTextFile(file: ReadFile): Promise<string> {
  const res = await fetch(file.uri);
  return (await res.text()).slice(0, 20_000);
}

/**
 * Picked or dropped files as things to check: the photos and PDFs together
 * (pages of one thing), each text or .csv file on its own. `separate` gives
 * every file its own check (a drop of several files).
 */
export async function sourcesFromFiles(files: ReadFile[], separate = false): Promise<ReadSource[]> {
  const pages = files.filter((f) => isReadableFile(f.mimeType));
  const texts = files.filter((f) => !isReadableFile(f.mimeType) && isTextFile(f.mimeType, f.name));
  const fromText = await Promise.all(texts.map(async (f): Promise<ReadSource> => ({ files: [], text: await readTextFile(f), url: null, name: f.name ?? null })));
  const fromPages: ReadSource[] = separate ? pages.map((f) => ({ files: [f], text: null, url: null, name: f.name ?? null })) : pages.length ? [{ files: pages, text: null, url: null, name: pages[0].name ?? null }] : [];
  return [...fromPages, ...fromText];
}
