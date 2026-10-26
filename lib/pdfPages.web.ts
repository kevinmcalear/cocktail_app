import type { ReadFile } from '@/lib/readAnything';

/**
 * The web doesn't draw a PDF's pages yet: Reading keeps the PDF's card.
 * ponytail: pdf.js (pdfjs-dist) could draw them here, lazy-loaded; Kevin's
 * answer on E37 was the phone first.
 */
export async function pdfPages(_file: ReadFile): Promise<ReadFile[]> {
  return [];
}
