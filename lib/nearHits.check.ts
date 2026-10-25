// Checks for lib/nearHits.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { SearchItem } from '@/types/search';

import { classicHit, fromRow, mergeNear, nearIn, nearView, nearWhy, searchItemHit, type NearHit } from './nearHits';

const hit = (id: string, name: string, score: number, known = false): NearHit => ({
  kind: 'drink',
  id,
  name,
  caption: null,
  href: `/cocktail/${id}`,
  imageUrl: null,
  score,
  known,
  spellingFor: id,
});

// Database rows: drinks open their page and may save a spelling; bars and people open theirs by handle.
assert.deepEqual(fromRow({ kind: 'drink', id: 'd1', name: 'Salti Boi', place: 'Pale Moth · Collingwood', handle: null, score: 4, known: false }), {
  kind: 'drink',
  id: 'd1',
  name: 'Salti Boi',
  caption: 'Pale Moth · Collingwood',
  href: '/cocktail/d1',
  imageUrl: null,
  score: 4,
  known: false,
  spellingFor: 'd1',
});
assert.equal(fromRow({ kind: 'bar', id: 'b1', name: 'The Lantern Room', place: 'Melbourne', handle: 'lantern', score: 4, known: false })?.href, '/p/lantern');
assert.equal(fromRow({ kind: 'person', id: 'p1', name: 'Rémy Savage', place: null, handle: null, score: 2, known: false })?.href, '/p/p1');
assert.equal(fromRow({ kind: 'bar', id: 'b1', name: 'X', place: null, handle: null, score: 1, known: false })?.spellingFor, null);
assert.equal(fromRow({ kind: 'menu', id: 'm1', name: 'X', place: null, handle: null, score: 1, known: false }), null);

// Your own: a drink saves its spelling, a draft doesn't, a menu isn't a close name.
const card = (over: Partial<SearchItem>) => ({ id: 'beer-b1', name: 'Salti Boi', category: 'Beer', ...over }) as SearchItem;
assert.deepEqual(searchItemHit(card({}), 'Little Rye'), { kind: 'drink', id: 'beer-b1', name: 'Salti Boi', caption: 'Little Rye', href: '/beer/beer-b1', imageUrl: null, spellingFor: 'b1' });
assert.equal(searchItemHit(card({ isDraft: true }), 'Little Rye')?.spellingFor, null);
assert.equal(searchItemHit(card({ isDraft: true }), 'Little Rye')?.caption, 'Draft');
assert.equal(searchItemHit(card({ category: 'Menu', id: 'menu-m1' }), 'Little Rye'), null);
assert.equal(classicHit({ id: 'c1', name: 'Salty Dog' }).caption, 'Classic');

// Lists the app holds: only the close names, scored.
const local = nearIn('salty boy', [{ id: 'a', name: 'Salti Boi' }, { id: 'b', name: 'Smoke Signal' }], classicHit);
assert.deepEqual(local.map((h) => [h.id, h.score, h.known]), [['a', 2, false]]);

// Merging: shown rows out, each once (first list wins), saved spellings first, then closest, then shortest.
const merged = mergeNear(
  [
    [hit('a', 'Salti Boi', 4), hit('dup', 'Salty Bois', 3)],
    [hit('dup', 'Salty Bois (bar copy)', 1), hit('k', 'Salt Boy Fizz', 6, true), hit('s', 'Salty Dog', 12), hit('shown', 'Salty Boy', 0)],
  ],
  new Set(['shown'])
);
assert.deepEqual(merged.map((h) => h.id), ['k', 'dup', 'a', 's']);
assert.equal(merged.find((h) => h.id === 'dup')?.name, 'Salty Bois');
assert.equal(mergeNear([[hit('a', 'A', 1), hit('b', 'B', 2)]], new Set(), 1).length, 1);

// What the results do: nothing close is the plain miss; nothing found asks; a saved spelling is a result; found lists last.
assert.deepEqual(nearView(0, []), { kind: 'none' });
assert.deepEqual(nearView(3, []), { kind: 'none' });
const ask = nearView(0, [hit('a', 'Salti Boi', 4), hit('s', 'Salty Dog', 12)]);
assert.equal(ask.kind === 'ask' && ask.best.id, 'a');
assert.deepEqual(ask.kind === 'ask' && ask.also.map((h) => h.id), ['s']);
const known = nearView(0, [hit('k', 'Salti Boi', 0, true), hit('s', 'Salty Dog', 12)]);
assert.deepEqual(known.kind === 'known' && [known.known.map((h) => h.id), known.also.map((h) => h.id)], [['k'], ['s']]);
const listed = nearView(2, [hit('a', 'Salti Boi', 4)]);
assert.deepEqual(listed.kind === 'listed' && listed.hits.map((h) => h.id), ['a']);

// Why a row is here, in a few words.
assert.equal(nearWhy(' salty boy ', 'Salti Boi'), 'spelled close to “salty boy”');
assert.equal(nearWhy('peeny colada', 'Pina Colada'), 'sounds like “peeny colada”');
assert.equal(nearWhy('salt', 'Salty Guava'), 'starts like “salt”');
assert.equal(nearWhy('jungel bird', 'Jungle Bird'), 'spelled close to “jungel bird”');
assert.equal(nearWhy('salty boi', 'Salty Boi'), null);

console.log('nearHits checks passed');
