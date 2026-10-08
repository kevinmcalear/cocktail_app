import { Platform } from 'react-native';

import { ensureAiConsent } from '@/lib/aiConsent';
import { isReadableFile } from '@/lib/bringInAnywhere';
import { uriToBase64 } from '@/lib/imageBase64';
import { invokeFunction } from '@/lib/invokeFunction';
import { AI_DECLINED, pickMenuPhotos, type MenuPhoto } from '@/lib/readMenu';
import type { AnythingReading, ReadKind } from '@/supabase/functions/_shared/anythingRead';

export type { AnythingReading, ReadKind };

/** A photo or a PDF to read. */
export type ReadFile = MenuPhoto;

export const MAX_READ_FILES = 4;

export { isReadableFile };

/** On web (and the desktop shell) a file chooser for photos and PDFs; on native, the photo library. Empty when cancelled. */
export function pickReadFiles(): Promise<ReadFile[]> {
  if (Platform.OS !== 'web') return pickMenuPhotos(MAX_READ_FILES);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.multiple = true;
    input.onchange = () =>
      resolve(
        Array.from(input.files ?? [])
          .filter((file) => isReadableFile(file.type))
          .slice(0, MAX_READ_FILES)
          .map((file) => ({ uri: URL.createObjectURL(file), mimeType: file.type })),
      );
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/**
 * Reads photos, PDFs, text or a link (read-anything): a menu, recipes or bottles,
 * whichever it is. `hint` is the screen the person started from. Asks for the
 * Google AI OK first.
 */
export async function readAnything({ files = [], text = '', url, hint }: { files?: ReadFile[]; text?: string; url?: string; hint: ReadKind | null }): Promise<AnythingReading> {
  if (!(await ensureAiConsent())) throw new Error(AI_DECLINED);
  const encoded = await Promise.all(files.slice(0, MAX_READ_FILES).map(async (file) => ({ base64: await uriToBase64(file.uri), mime_type: file.mimeType })));
  return invokeFunction<AnythingReading>('read-anything', { files: encoded, text: text.trim() || undefined, url, hint });
}
