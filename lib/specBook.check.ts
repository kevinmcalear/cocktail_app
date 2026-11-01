// Checks for lib/specBook.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { QueryClient } from '@tanstack/react-query';

import { bookFor, bookItem, bookMenu, booksInCache, isSpecBook, SPEC_BOOK_VERSION, specBookKey, type SpecBook } from './specBook';

const book = (barId: string, items: string[], syncedAt = 1): SpecBook => ({
  v: SPEC_BOOK_VERSION,
  barId,
  syncedAt,
  items: items.map((id) => ({ id, name: id }) as SpecBook['items'][number]),
  menus: [],
  onNow: [{ id: `${barId}-menu`, name: 'On now', sections: [] } as unknown as SpecBook['onNow'][number]],
});

const client = new QueryClient();
client.setQueryData(specBookKey('b1'), book('b1', ['negroni', 'house-orgeat'], 100));
client.setQueryData(specBookKey('b2'), book('b2', ['daiquiri'], 200));
client.setQueryData(specBookKey('b1', 2), book('b1', ['negroni'], 300));

assert.equal(booksInCache(client).length, 2, 'the person’s own books');
assert.equal(booksInCache(client, 2).length, 1, 'a View as preview reads only its own');
assert.equal(bookFor(client, 'b2')?.syncedAt, 200);

assert.deepEqual(bookItem(client, 'house-orgeat'), { item: { id: 'house-orgeat', name: 'house-orgeat' }, syncedAt: 100 }, 'found in its venue’s book');
assert.equal(bookItem(client, 'daiquiri')?.syncedAt, 200, 'any venue the person works at');
assert.equal(bookItem(client, 'daiquiri', 2), undefined, 'a preview never reads the unpreviewed book');
assert.equal(bookItem(client, 'negroni', 2)?.syncedAt, 300);
assert.equal(bookItem(client, 'missing'), undefined);
assert.equal(bookItem(client, undefined), undefined);

assert.equal(bookMenu(client, 'b2-menu')?.syncedAt, 200, 'a list on now');
assert.equal(bookMenu(client, 'nope'), undefined);

assert.ok(isSpecBook(book('b1', [])));
assert.ok(!isSpecBook({ ...book('b1', []), v: 0 }), 'a book saved by older code is fetched again');
assert.ok(!isSpecBook(null));

console.log('specBook checks passed');
