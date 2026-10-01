// Checks for lib/hadDrinks.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { favourites, hadStats, sortHad, tallyBars, toHadDrink, whereLine, type HadDrink, type HadRow } from './hadDrinks';

const bellamy = { id: 'v1', handle: 'bar.bellamy', display_name: 'Bar Bellamy', avatar_url: null, locality: 'Carlton', city: 'Melbourne' };
const shapes = { id: 'v2', handle: null, display_name: 'Shapes', avatar_url: 'https://x/logo.png', locality: null, city: 'London' };

const row = (over: Partial<HadRow> & { id: string }): HadRow => ({
  item_id: `item-${over.id}`,
  sentiment: 'loved',
  had_on: null,
  created_at: '2026-09-01T10:00:00Z',
  score: 10,
  item: { name: `Drink ${over.id}`, item_images: null },
  list: null,
  venue: null,
  ...over,
});

// --- Rows ---
const martini = toHadDrink(
  row({
    id: 'a',
    score: '8.4', // PostgREST sends numerics as strings
    item: { name: 'House Martini', item_images: [{ is_generated: true, images: { url: 'https://x/sketch.png' } }, { images: { url: 'https://x/photo.jpg' } }] },
    list: { name: 'Martini' },
    venue: bellamy,
    had_on: '2026-08-14',
  })
);
assert.equal(martini.score, 8.4);
assert.equal(martini.listName, 'Martini');
assert.equal(martini.imageUrl, 'https://x/photo.jpg', 'a photo leads a sketch');
assert.equal(martini.isSketch, false);
assert.deepEqual(martini.venue, { id: 'v1', handle: 'bar.bellamy', name: 'Bar Bellamy', avatarUrl: null, place: 'Carlton, Melbourne' });
assert.equal(whereLine(martini), 'Bar Bellamy, Carlton');

// The classic itself: no separate list name. At home: no venue.
const home = toHadDrink(row({ id: 'b', item: { name: 'Negroni', item_images: [] }, list: { name: 'Negroni' } }));
assert.equal(home.listName, null);
assert.equal(home.imageUrl, null);
assert.equal(whereLine(home), 'At home');

// A drink the reader can't open any more keeps its list's name, then a plain one.
assert.equal(toHadDrink(row({ id: 'c', item: null, list: { name: 'Daiquiri' } })).name, 'Daiquiri');
assert.equal(toHadDrink(row({ id: 'd', item: null })).name, 'A drink');
assert.equal(whereLine(toHadDrink(row({ id: 'e', venue: shapes }))), 'Shapes, London');

// --- Sorting, favourites, bars ---
const drink = (id: string, score: number, over: Partial<HadRow> = {}): HadDrink =>
  toHadDrink(row({ id, score, sentiment: score >= 6.7 ? 'loved' : score >= 3.4 ? 'fine' : 'disliked', ...over }));

const had = [
  drink('1', 10, { venue: bellamy, had_on: '2026-06-01' }),
  drink('2', 5, { venue: bellamy, had_on: '2026-09-20' }),
  drink('3', 10, { venue: shapes, had_on: '2026-09-10' }),
  drink('4', 8.4, { had_on: null, created_at: '2026-09-25T09:00:00Z' }),
  drink('5', 1.7, { venue: shapes, had_on: '2026-01-02' }),
];

assert.deepEqual(sortHad(had, 'score').map((d) => d.id), ['3', '1', '4', '2', '5'], 'best first; a tie goes to the latest');
assert.deepEqual(sortHad(had, 'recent').map((d) => d.id), ['4', '2', '3', '1', '5'], 'no day given: the day it was ranked');
assert.deepEqual(had.map((d) => d.id), ['1', '2', '3', '4', '5'], 'sorting copies');

assert.deepEqual(favourites(had).map((d) => d.id), ['3', '1', '4'], 'only drinks they loved');
assert.deepEqual(favourites(had, 2).map((d) => d.id), ['3', '1']);
assert.deepEqual(favourites([drink('x', 5)]), []);

const bars = tallyBars(had);
assert.deepEqual(
  bars.map((b) => [b.key, b.drinks, b.average, b.best.name]),
  [
    ['home', 1, 8.4, 'Drink 4'],
    ['v1', 2, 7.5, 'Drink 1'],
    ['v2', 2, 5.9, 'Drink 3'], // (10 + 1.7) / 2 = 5.85
  ]
);
assert.equal(bars[0].venue, null);
assert.equal(bars[1].venue?.name, 'Bar Bellamy');
// Same average: the bar with more drinks first.
assert.deepEqual(tallyBars([drink('1', 8, { venue: shapes }), drink('2', 9, { venue: bellamy }), drink('3', 7, { venue: bellamy })]).map((b) => b.key), ['v1', 'v2']);
assert.deepEqual(tallyBars([]), []);

assert.deepEqual(hadStats(had), { drinks: 5, bars: 2 }, 'home is not a bar');
assert.deepEqual(hadStats([]), { drinks: 0, bars: 0 });

console.log('hadDrinks checks passed');
