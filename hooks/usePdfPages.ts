import { useQuery } from '@tanstack/react-query';

import { pdfPages } from '@/lib/pdfPages';
import type { ReadFile } from '@/lib/readAnything';

/**
 * Each PDF's pages as pictures, by the PDF's uri (lib/pdfPages.ts): drawn on
 * the phone once per file while Reading is open. Not kept: the pictures are
 * cache files the system can clear.
 */
export function usePdfPages(files: readonly ReadFile[]) {
  const pdfs = files.filter((f) => f.mimeType === 'application/pdf' && !!f.uri);
  return useQuery({
    queryKey: ['pdf-pages', pdfs.map((f) => f.uri)],
    enabled: pdfs.length > 0,
    meta: { persist: false },
    staleTime: Infinity,
    queryFn: async (): Promise<Record<string, ReadFile[]>> => Object.fromEntries(await Promise.all(pdfs.map(async (f) => [f.uri, await pdfPages(f)] as const))),
  });
}
