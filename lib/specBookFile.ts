import type { QueryClient } from '@tanstack/react-query';

import { fileStore } from '@/lib/fileStore';
import { isSpecBook, specBookKey, type SpecBook } from '@/lib/specBook';

/** Each venue's book, saved as one file named for the venue. */
const saved = fileStore('spec-books');

export const saveSpecBook = (book: SpecBook) => saved.write(book.barId, book);

/**
 * Reads every book saved on this phone into memory, before the first screen
 * paints (lib/react-query.ts), so Tonight and a drink page open from it with
 * no spinner and no signal. Each keeps its sync time, so an old one refreshes.
 */
export async function loadSavedSpecBooks(client: QueryClient): Promise<void> {
  const books = await Promise.all((await saved.names()).map((name) => saved.read(name)));
  for (const book of books) {
    if (isSpecBook(book) && !client.getQueryData(specBookKey(book.barId))) {
      client.setQueryData(specBookKey(book.barId), book, { updatedAt: book.syncedAt });
    }
  }
}

/** Forgets the books of venues the person no longer works at, on the phone and in memory. */
export async function dropOtherSpecBooks(client: QueryClient, barIds: readonly string[]): Promise<void> {
  const gone = (await saved.names()).filter((name) => !barIds.includes(name));
  for (const barId of gone) client.removeQueries({ queryKey: ['spec-book', barId] });
  await Promise.all(gone.map((name) => saved.remove(name)));
}

/** At sign-out: the next person on a shared bar iPad must not open these. */
export const clearSavedSpecBooks = () => saved.clear();
