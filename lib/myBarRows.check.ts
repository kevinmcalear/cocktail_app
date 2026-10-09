import assert from 'node:assert/strict';
import { MAKE_PAGE, makeTab, myBarRows } from './myBarRows';

const bottle = (i: number, kind: string | null = null) => ({ id: `b${i}`, name: `Bottle ${i}`, kind, uses: i % 2 });
const drink = (i: number) => ({ id: `d${i}` });
const group = (i: number) => ({ bottles: [{ id: `x${i}` }], drinks: [drink(i)] });
const kinds = (rows: { kind: string }[]) => rows.map((r) => r.kind);

// An empty shelf: the top, the pantry, the other sections folded, nothing to make yet.
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: null })), ['top', 'pantry', 'folds']);

// A serious bar: shortcuts at the top, each filled section in turn, only the empty one folded.
const full = myBarRows({ bottles: [bottle(1)], sort: 'newest', query: '', shelfOpen: false, cols: 3, more: { lab: 3, preps: 0, kit: 2 }, make: null });
assert.deepEqual(kinds(full), ['top', 'jump', 'shelf-head', 'bottles', 'shelf-foot', 'pantry', 'lab', 'kit', 'folds']);
assert.deepEqual(full.at(-1), { kind: 'folds', key: 'folds', empty: ['preps'] });
assert.equal(new Set(full.map((r) => r.key)).size, full.length);

// Bottles come a row of tiles at a time; a long shelf folds to two rows until opened, and a search shows every match.
const tiles = (rows: ReturnType<typeof myBarRows>) => rows.flatMap((r) => (r.kind === 'bottles' ? [r.bottles.length] : []));
const bottles = Array.from({ length: 40 }, (_, i) => bottle(i));
const folded = myBarRows({ bottles, sort: 'newest', query: '', shelfOpen: false, cols: 3, make: null });
assert.deepEqual(tiles(folded), [3, 3]);
assert.deepEqual(tiles(myBarRows({ bottles, sort: 'newest', query: '', shelfOpen: false, cols: 4, make: null })), [4, 4], 'wider rows on a wider screen');
assert.deepEqual(folded.at(-3), { kind: 'shelf-foot', key: 'shelf-foot', found: 40 });
assert.deepEqual(tiles(myBarRows({ bottles, sort: 'newest', query: '', shelfOpen: true, cols: 3, make: null })), [...Array(13).fill(3), 1]);
assert.equal(tiles(myBarRows({ bottles, sort: 'newest', query: 'Bottle 1', shelfOpen: false, cols: 3, make: null })).reduce((a, b) => a + b), 11);

// By style: each style starts a new row with its caption, bottles with none under Other.
const styled = myBarRows({ bottles: [bottle(1, 'Gin'), bottle(2, null), bottle(3, 'Gin'), bottle(4, 'Amaro'), bottle(5, 'Gin'), bottle(6, 'Gin'), bottle(7, 'Gin')], sort: 'style', query: '', shelfOpen: true, cols: 3, make: null });
assert.deepEqual(
  styled.flatMap((r) => (r.kind === 'bottles' ? [[r.heading, r.bottles.length]] : [])),
  [['Amaro', 1], ['Gin', 3], [null, 2], ['Other', 1]],
);

// What to make: a page of drinks, then "Show more" with the rest counted.
const canMake = Array.from({ length: 60 }, (_, i) => drink(i));
const make = { canMake, oneAway: [group(1)], twoAway: [], tab: 'ready' as const, shown: MAKE_PAGE };
const ready = myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make });
assert.equal(ready.filter((r) => r.kind === 'drink').length, MAKE_PAGE);
assert.deepEqual(ready.at(-1), { kind: 'make-foot', key: 'make-foot', more: 60 - MAKE_PAGE });
// Keys are unique, so the list never confuses two rows.
assert.equal(new Set(ready.map((r) => r.key)).size, ready.length);

// The other tabs list bottle groups; an empty tab says so.
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: { ...make, tab: 'one' } })).slice(3), ['make-head', 'group', 'make-foot']);
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: { ...make, tab: 'two' } })).slice(3), ['make-head', 'make-empty', 'make-foot']);

// Make first is one row too.
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: { ...make, first: 3, tab: 'first' } })).slice(3), ['make-head', 'first', 'make-foot']);

// Projects are one row, with no "Show more"; none says so.
const projects = myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: { ...make, projects: 12, tab: 'projects' } });
assert.deepEqual(kinds(projects).slice(3), ['make-head', 'projects', 'make-foot']);
assert.deepEqual(projects.at(-1), { kind: 'make-foot', key: 'make-foot', more: 0 });
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: { ...make, projects: 0, tab: 'projects' } })).slice(3), ['make-head', 'make-empty', 'make-foot']);

// The tab opens on what you can make, else on what's closest.
assert.equal(makeTab(null, { canMake: [], oneAway: [], twoAway: [1] }), 'two');
assert.equal(makeTab(null, { canMake: [], oneAway: [1], twoAway: [1] }), 'one');
assert.equal(makeTab('two', { canMake: [1], oneAway: [], twoAway: [] }), 'two');

console.log('myBarRows checks passed');
