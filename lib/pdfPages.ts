import PdfThumbnail from 'react-native-pdf-thumbnail';

import type { ReadFile } from '@/lib/readAnything';

/**
 * A PDF's pages as pictures, drawn on the phone (board w2-import-review, E37
 * A): react-native-pdf-thumbnail, which uses PDFKit on iOS and PdfRenderer on
 * Android, writes each page as a JPEG in the cache. Empty when it can't: an
 * app build from before this library (the call throws its linking error), a
 * PDF locked with a password, a file that's gone. The web has pdfPages.web.ts.
 */
export async function pdfPages(file: ReadFile): Promise<ReadFile[]> {
  if (file.mimeType !== 'application/pdf' || !file.uri) return [];
  try {
    // About A4 at 150 dpi: sharp enough to read a spec, small enough for a 40-page book.
    const pages = await PdfThumbnail.generateAllPages(file.uri, { maxWidth: 1240, maxHeight: 1754, quality: 80 });
    return pages.map((p, i) => ({ uri: p.uri, mimeType: 'image/jpeg', name: `${file.name ?? 'PDF'}, page ${i + 1}` }));
  } catch {
    return [];
  }
}
