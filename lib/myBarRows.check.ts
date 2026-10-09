import assert from 'node:assert/strict';
import { MAKE_PAGE, makeTab, myBarRows, SHELF_FOLDED } from './myBarRows';

const bottle = (i: number, kind: string | null = null) => ({ id: `b${i}`, name: `Bottle ${i}`, kind, uses: i % 2 });
const drink = (i: number) => ({ id: `d${i}` });
const group = (i: number) => ({ bottles: [{ id: `x${i}` }], drinks: [drink(i)] });
const kinds = (rows: { kind: string }[]) => rows.map((r) => r.kind);

// An empty shelf: the top, the pantry, the other sections folded, nothing to make yet.
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, make: null })), ['top', 'pantry', 'folds']);

// A serious bar: shortcuts at the top, each filled section in turn, only the empty one folded.
const full = myBarRows({ bottles: [bottle(1)], sort: 'newest', query: '', shelfOpen: false, more: { lab: 3, preps: 0, kit: 2 }, make: null });
assert.deepEqual(kinds(full), ['top', 'jump', 'shelf-head', 'bottle', 'shelf-foot', 'pantry', 'lab', 'kit', 'folds']);
assert.deepEqual(full.at(-1), { kind: 'folds', key: 'folds', empty: ['preps'] });
assert.equal(new Set(full.map((r) => r.key)).size, full.length);

// A long shelf folds to five until opened; a search shows every match.
const bottles = Array.from({ length: 40 }, (_, i) => bottle(i));
const folded = myBarRows({ bottles, sort: 'newest', query: '', shelfOpen: false, make: null });
assert.equal(folded.filter((r) => r.kind === 'bottle').length, SHELF_FOLDED);
assert.deepEqual(folded.at(-3), { kind: 'shelf-foot', key: 'shelf-foot', found: 40 });
assert.equal(myBarRows({ bottles, sort: 'newest', query: '', shelfOpen: true, make: null }).filter((r) => r.kind === 'bottle').length, 40);
assert.equal(myBarRows({ bottles, sort: 'newest', query: 'Bottle 1', shelfOpen: false, make: null }).filter((r) => r.kind === 'bottle').length, 11);

// By style: a caption above the first bottle of each style, bottles with none under Other.
const styled = myBarRows({ bottles: [bottle(1, 'Gin'), bottle(2, null), bottle(3, 'Gin'), bottle(4, 'Amaro')], sort: 'style', query: '', shelfOpen: true, make: null });
assert.deepEqual(
  styled.flatMap((r) => (r.kind === 'bottle' ? [r.heading] : [])),
  ['Amaro', 'Gin', null, 'Other'],
);

// What to make: a page of drinks, then "Show more" with the rest counted.
const canMake = Array.from({ length: 60 }, (_, i) => drink(i));
const make = { canMake, oneAway: [group(1)], twoAway: [], tab: 'ready' as const, shown: MAKE_PAGE };
const ready = myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, make });
assert.equal(ready.filter((r) => r.kind === 'drink').length, MAKE_PAGE);
assert.deepEqual(ready.at(-1), { kind: 'make-foot', key: 'make-foot', more: 60 - MAKE_PAGE });
// Keys are unique, so the list never confuses two rows.
assert.equal(new Set(ready.map((r) => r.key)).size, ready.length);

// The other tabs list bottle groups; an empty tab says so.
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, make: { ...make, tab: 'one' } })).slice(3), ['make-head', 'group', 'make-foot']);
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, make: { ...make, tab: 'two' } })).slice(3), ['make-head', 'make-empty', 'make-foot']);

// Make first is one row too.
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, make: { ...make, first: 3, tab: 'first' } })).slice(3), ['make-head', 'first', 'make-foot']);

// Projects are one row, with no "Show more"; none says so.
const projects = myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, make: { ...make, projects: 12, tab: 'projects' } });
assert.deepEqual(kinds(projects).slice(3), ['make-head', 'projects', 'make-foot']);
assert.deepEqual(projects.at(-1), { kind: 'make-foot', key: 'make-foot', more: 0 });
assert.deepEqual(kinds(myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, make: { ...make, projects: 0, tab: 'projects' } })).slice(3), ['make-head', 'make-empty', 'make-foot']);

// The tab opens on what you can make, else on what's closest.
assert.equal(makeTab(null, { canMake: [], oneAway: [], twoAway: [1] }), 'two');
assert.equal(makeTab(null, { canMake: [], oneAway: [1], twoAway: [1] }), 'one');
assert.equal(makeTab('two', { canMake: [1], oneAway: [], twoAway: [] }), 'two');

console.log('myBarRows checks passed');
