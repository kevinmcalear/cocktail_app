import assert from 'node:assert/strict';
import { MAKE_PAGE, makeTab, myBarRows, searchCaption, searchMake } from './myBarRows';

const bottle = (i: number, kind: string | null = null) => ({ id: `b${i}`, name: `Bottle ${i}`, kind, uses: i % 2 });
const drink = (i: number) => ({ id: `d${i}`, name: `Drink ${i}` });
const group = (i: number) => ({ bottles: [{ id: `x${i}`, name: `Bottle x${i}` }], drinks: [drink(i)] });
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

// --- Search: every tab at once ---
const named = (id: string, name: string, shelfUses: string[] = []) => ({ id, name, shelfUses });
const search = {
  canMake: [named('manhattan', 'Manhattan', ['rittenhouse', 'vermouth']), named('daiquiri', 'Daiquiri', ['rum', 'lime']), named('fizz', 'Gin Fizz', ['gin', 'lime'])],
  oneAway: [
    { bottles: [{ id: 'campari', name: 'Campari' }], drinks: [named('negroni', 'Negroni', ['gin', 'vermouth']), named('boulevardier', 'Boulevardier', ['rittenhouse', 'vermouth'])] },
    { bottles: [{ id: 'chartreuse', name: 'Chartreuse' }], drinks: [named('lastword', 'Last Word', ['gin', 'lime'])] },
  ],
  twoAway: [{ bottles: [{ id: 'mezcal', name: 'Mezcal' }, { id: 'aperol', name: 'Aperol' }], drinks: [named('paper', 'Paper Plane'), named('naked', 'Naked & Famous')] }],
};
const shelf = [
  { id: 'rittenhouse', name: 'Rittenhouse', kind: 'Rye Whiskey' },
  { id: 'vermouth', name: 'Cocchi di Torino', kind: 'Sweet Vermouth' },
  { id: 'rum', name: 'Havana Club 3', kind: 'Rum' },
  { id: 'lime', name: 'Lime', kind: null },
  { id: 'gin', name: 'Tanqueray', kind: 'Gin' },
];
const ids = (found: { ready: { id: string }[]; one: { drinks: { id: string }[] }[]; two: { drinks: { id: string }[] }[] }) => ({
  ready: found.ready.map((d) => d.id),
  one: found.one.flatMap((g) => g.drinks.map((d) => d.id)),
  two: found.two.flatMap((g) => g.drinks.map((d) => d.id)),
});

// By a drink's name, in any section.
assert.deepEqual(ids(searchMake(search, 'negro', shelf)), { ready: [], one: ['negroni'], two: [] });
// By a shelf bottle it uses, or that bottle's style: rye finds the Manhattan, and the Boulevardier one bottle away.
assert.deepEqual(ids(searchMake(search, 'rye', shelf)), { ready: ['manhattan'], one: ['boulevardier'], two: [] });
assert.deepEqual(ids(searchMake(search, 'LIME', shelf)), { ready: ['daiquiri', 'fizz'], one: ['lastword'], two: [] });
// By the bottle it's missing: the group's bottle matched, so all its drinks stay.
assert.deepEqual(ids(searchMake(search, 'campari', shelf)), { ready: [], one: ['negroni', 'boulevardier'], two: [] });
assert.deepEqual(ids(searchMake(search, 'aperol', shelf)), { ready: [], one: [], two: ['paper', 'naked'] });
// Accents don't matter, either way round.
const accented = { canMake: [named('cafe', 'Café Brûlot')], oneAway: [], twoAway: [] };
assert.deepEqual(ids(searchMake(accented, 'cafe brulot', [])), { ready: ['cafe'], one: [], two: [] });
assert.deepEqual(ids(searchMake(search, 'Cocchi di Torinó', shelf)), { ready: ['manhattan'], one: ['negroni', 'boulevardier'], two: [] });

// The rows: the caption counts, then Ready, One bottle away, Two bottles away, in that order, then the way to Search.
const searching = (query: string, extra: object = {}) =>
  myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: { ...search, tab: 'one' as const, shown: MAKE_PAGE, first: 2, projects: 4, query, shelf, ...extra } });
const vermouth = searching('vermouth');
assert.deepEqual(kinds(vermouth).slice(3), ['make-head', 'make-heading', 'drink', 'make-heading', 'group', 'make-foot']);
assert.deepEqual(vermouth[3], { kind: 'make-head', key: 'make-head', found: { ready: 1, one: 2, two: 0 } });
assert.deepEqual(vermouth.flatMap((r) => (r.kind === 'make-heading' ? [r.section] : [])), ['ready', 'one']);
const wide = searching('a');
assert.deepEqual(wide.flatMap((r) => (r.kind === 'make-heading' ? [r.section] : [])), ['ready', 'one', 'two']);
assert.equal(new Set(wide.map((r) => r.key)).size, wide.length);
// Make first and Projects aren't searched, and the tab picked doesn't matter.
assert.ok(!kinds(wide).some((k) => k === 'first' || k === 'projects' || k === 'make-empty'));
// A group keeps only the drinks that match, when its bottle doesn't.
const negroni = searching('negroni').find((r) => r.kind === 'group');
assert.deepEqual(negroni?.kind === 'group' && negroni.group.drinks.map((d) => d.id), ['negroni']);
assert.equal(negroni?.key, 'g:campari');
// Whitespace alone is no search: today's tabs.
assert.deepEqual(kinds(searching('  ')).slice(3), ['make-head', 'group', 'group', 'make-foot']);
// Nothing anywhere: one line, then Search every drink.
assert.deepEqual(searching(' zzz ').slice(3), [
  { kind: 'make-head', key: 'make-head', found: { ready: 0, one: 0, two: 0 } },
  { kind: 'make-none', key: 'make-none', query: 'zzz' },
  { kind: 'make-foot', key: 'make-foot', more: 0, searching: true },
]);

// Paging per section: each shows a page, with its own "Show more".
const many = { canMake: Array.from({ length: 30 }, (_, i) => named(`r${i}`, `Sour ${i}`)), oneAway: [], twoAway: [], tab: 'ready' as const, shown: MAKE_PAGE, query: 'sour' };
const paged = myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: many });
assert.equal(paged.filter((r) => r.kind === 'drink').length, MAKE_PAGE);
assert.deepEqual(paged.at(-2), { kind: 'make-more', key: 'more:ready', section: 'ready', more: 30 - MAKE_PAGE });
const opened = myBarRows({ bottles: [], sort: 'newest', query: '', shelfOpen: false, cols: 3, make: { ...many, shownIn: { ready: MAKE_PAGE * 2 } } });
assert.equal(opened.filter((r) => r.kind === 'drink').length, 30);
assert.ok(!opened.some((r) => r.kind === 'make-more'));

// The caption that replaces the tabs.
assert.equal(searchCaption(' rye ', { ready: 0, one: 3, two: 1 }), 'Nothing ready with rye. 3 one bottle away, 1 two away.');
assert.equal(searchCaption('gin', { ready: 4, one: 2, two: 0 }), '4 ready, 2 one bottle away.');
assert.equal(searchCaption('gin', { ready: 1, one: 0, two: 0 }), '1 ready.');
assert.equal(searchCaption('zzz', { ready: 0, one: 0, two: 0 }), null);

console.log('myBarRows checks passed');
