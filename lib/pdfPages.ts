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
    // Three times the large page's width on a phone: sharp enough to read a spec, small enough for a long book.
    // ponytail: every page is drawn at once (the library has no page count to draw them as they're shown); fine for spec books of tens of pages.
    const pages = await PdfThumbnail.generateAllPages(file.uri, { maxWidth: 1000, maxHeight: 1400, quality: 80 });
    return pages.map((p, i) => ({ uri: p.uri, mimeType: 'image/jpeg', name: `${file.name ?? 'PDF'}, page ${i + 1}` }));
  } catch {
    return [];
  }
}
