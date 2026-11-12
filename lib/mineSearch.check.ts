// Checks for lib/mineSearch.ts. Run: npm run test:unit
// The guard (Quality bar B6): at a venue, search answers from the spec book.
// These fail if a screen goes back to matching the venue's whole list on
// every letter.
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';

import { bookSearchItem, mineGroups, narrowView } from './mineSearch';
import { SPEC_BOOK_VERSION, type SpecBook } from './specBook';
import { benchCorpus } from './specSearchBench';
import { buildSearchIndex, rankHits, searchNames, searchNear, type SearchHit } from './specSearch';
import type { SearchItem } from '@/types/search';
import type { DatabaseItem } from '@/types/types';

const extra = [
  { id: 'b1', name: 'Negroni Sour Ale', item_type: 'beer' },
  { id: 'w1', name: 'Etna Rosso', item_type: 'wine' },
  { id: 'i1', name: 'Secret Syrup', item_type: 'ingredient', hide_from_search: true },
  { id: 'g1', name: 'Negroni Glass', item_type: 'glassware' },
] as unknown as DatabaseItem[];
const items = [...benchCorpus(1000), ...extra];
const book: SpecBook = { v: SPEC_BOOK_VERSION, barId: 'bar', syncedAt: 0, items, menus: [], onNow: [] };
const index = buildSearchIndex('bar', items);
/** What hooks/useSpecSearch.ts hands over: names, then near misses when those are thin. */
function search(q: string): SearchHit[] {
  const named = searchNames(index, q);
  const near = named.length < 5 ? searchNear(index, q, new Set(named.map((h) => h.item.id!))) : [];
  return rankHits([...named, ...near], new Set(), Infinity);
}

// --- a book item is the card the lists make ---
assert.deepEqual(bookSearchItem(items[0]), { id: 'd0', name: 'Negroni', description: undefined, category: 'Cocktail', serviceStyle: null, recipes: items[0].recipes, item_images: undefined, item_categories: undefined, method_id: null, glassware_id: undefined, ice_id: undefined });
assert.equal(bookSearchItem(extra[0])?.id, 'beer-b1', 'a beer keeps its kind in its id');
assert.equal(bookSearchItem(extra[1])?.category, 'Wine');
assert.equal(bookSearchItem(extra[2]), null, 'an ingredient hidden from search');
assert.equal(bookSearchItem(extra[3]), null, 'a glass is not a search row');
assert.equal(bookSearchItem(items[0]), bookSearchItem(items[0]), 'the same card every letter');

// --- the venue's lists as the catalog holds them: every read of a published row's name is counted ---
let reads = 0;
const counted = (item: SearchItem): SearchItem => {
  const { name, ...rest } = item;
  return Object.defineProperty(rest, 'name', { enumerable: true, get: () => (reads++, name) }) as SearchItem;
};
const published = items.flatMap((i) => bookSearchItem(i) ?? []).map(counted);
const drafts: SearchItem[] = [
  { id: 'draft-1', name: 'Negroni Bianco', category: 'Cocktail', isDraft: true },
  { id: 'draft-2', name: 'Fig Leaf Syrup', category: 'Ingredient', isDraft: true },
];
const menus: SearchItem[] = [{ id: 'menu-1', name: 'Negroni Week', category: 'Menu' }];
const catalog = [...published, ...drafts, ...menus];

// --- Search at a venue: the book answers, the lists are not matched ---
reads = 0;
for (const typed of ['n', 'ne', 'neg', 'negr', 'negro', 'negron', 'negroni']) mineGroups(catalog, typed, search(typed), [book]);
assert.equal(reads, 0, 'at a venue no letter reads down the venue’s drinks and ingredients');

const found = mineGroups(catalog, 'negroni', search('negroni'), [book]);
assert.equal(found.groups.drinks[0].name, 'Negroni', 'the exact name leads');
assert.ok(found.groups.drinks.some((i) => i.id === 'beer-b1'), 'beer and wine are drinks');
assert.equal(found.groups.drinks.at(-1)?.id, 'draft-1', 'a draft follows the book’s rows');
assert.deepEqual(found.groups.menus.map((i) => i.id), ['menu-1'], 'menus keep the plain match');
assert.ok(found.groups.drinks.every((i) => i.id !== 'g1'));
assert.ok(mineGroups(catalog, 'campari', search('campari'), [book]).groups.drinks.length > 10, 'a drink is found by what’s in it');
assert.deepEqual(mineGroups(catalog, 'fig leaf', search('fig leaf'), [book]).groups.ingredients.map((i) => i.id), ['draft-2']);
assert.ok(mineGroups(catalog, 'house camp', search('house camp'), [book]).groups.ingredients.every((i) => i.category === 'Ingredient'));

// A typo: nothing as typed, and the close names go to Did you mean with the drafts.
const typo = mineGroups(catalog, 'negorni', search('negorni'), [book]);
assert.deepEqual(typo.groups, { drinks: [], ingredients: [], menus: [] });
assert.ok(typo.near.some((i) => i.id === 'd0') && typo.near.some((i) => i.id === 'draft-1'));
assert.ok(typo.near.length < 50, 'Did you mean looks through a handful, not the venue');

// A drink saved since the book was synced is found by the plain match until the book catches up.
const fresh: SearchItem = { id: 'new-1', name: 'Negroni Nuovo', category: 'Cocktail' };
assert.ok(mineGroups([...catalog, fresh], 'negroni', search('negroni'), [book]).groups.drinks.some((i) => i.id === 'new-1'));

// R&D trials stay out.
assert.ok(mineGroups(catalog, 'negroni', search('negroni'), [book], new Set(['d0'])).groups.drinks.every((i) => i.id !== 'd0'));

// Home, or no book on this phone: the plain match over everything, as before.
const home = mineGroups(catalog, 'negroni', null, []);
assert.ok(home.groups.drinks.length > 10 && home.near === catalog);
assert.ok(reads > 0);

// --- the Drinks tab's view at a venue ---
const shared: SearchItem[] = [{ id: 'shared-1', name: 'Campari', category: 'Ingredient' }, { id: 'shared-2', name: 'Aperol', category: 'Ingredient' }];
const view = [...published, ...shared];
const narrowed = narrowView(view, 'campari', search('campari'), [book]);
assert.ok(narrowed.shown.length > 10 && narrowed.shown.some((i) => i.id === 'shared-1'), 'a shared bottle no book holds keeps the plain match');
const names = narrowed.shown.map((i) => i.name);
assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), 'A to Z');
reads = 0;
const one = narrowView(view, 'vieux carre', search('vieux carre'), [book]);
// Sorting the rows that show reads their names; the other thousand are never read.
assert.ok(one.shown.length >= 1 && reads < view.length / 4, `only the rows that show are read (${reads} reads for ${one.shown.length} rows of ${view.length})`);
const close = narrowView(view, 'negorni', search('negorni'), [book]);
assert.deepEqual(close.shown, []);
assert.ok(close.near.some((i) => i.id === 'd0') && close.near.length < 50);
assert.equal(narrowView(view, '', [], [book]).shown.length, view.length, 'nothing typed: the whole view');
assert.ok(narrowView(view, 'campari', null, []).shown.some((i) => i.id === 'shared-1'), 'no book: the plain match');

// --- no screen matches a list itself ---
// PublicResults matches your own drinks under Everywhere at home, where there is no spec book.
const ALLOWED = ['components/search/PublicResults.tsx'];
const offenders = globSync('{app,components}/**/*.{ts,tsx}')
  .filter((file) => !ALLOWED.includes(file) && !/\.(check|test)\.tsx?$/.test(file))
  .filter((file) => /\b(matchesQuery|groupCatalog)\b/.test(readFileSync(file, 'utf8')));
assert.deepEqual(offenders, [], 'screens search through hooks/useMineSearch.ts, which asks the spec book at a venue');

console.log('mineSearch checks passed');
