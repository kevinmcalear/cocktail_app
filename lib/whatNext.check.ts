// Checks for lib/whatNext.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { classicsToAdd, glassMakers, groupGlasses, haveClassics, setupLine, topClassics } from './whatNext';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

// --- topClassics: most rankers first, catalog order breaks ties, then n ---
const catalog = ['martini', 'negroni', 'old-fashioned', 'daiquiri', 'aviation', 'zombie'].map((id) => ({ id }));
assert.deepEqual(ids(topClassics(catalog, {}, 3)), ['martini', 'negroni', 'old-fashioned'], 'no rankings: the catalog order');
assert.deepEqual(ids(topClassics(catalog, { zombie: 40, daiquiri: 25, negroni: 25 }, 4)), ['zombie', 'negroni', 'daiquiri', 'martini'], 'ranked first, ties in catalog order');
assert.equal(topClassics(Array.from({ length: 405 }, (_, i) => ({ id: `c${i}` })), {}).length, 20, '20 by default');
assert.equal(topClassics(catalog, {}).length, 6, 'fewer than 20 in the catalog: all of them');
// top_ranked_classics returns only the ranked ones (maybe one the catalog no longer has): the rest fill in catalog order.
assert.deepEqual(ids(topClassics(catalog, { aviation: 2, gone: 9 }, 3)), ['aviation', 'martini', 'negroni'], 'a few ranked, then best-known; unknown ids ignored');
assert.deepEqual(ids(catalog), ['martini', 'negroni', 'old-fashioned', 'daiquiri', 'aviation', 'zombie'], 'the catalog is left as it was');

// --- haveClassics: a version of it, or the same name, at the bar ---
const classics = [
  { id: 'n', name: 'Negroni' },
  { id: 'd', name: 'Daiquiri' },
  { id: 'm', name: 'Martini' },
];
assert.deepEqual([...haveClassics(classics, [{ name: 'House Negroni', riff_of_id: 'n' }, { name: ' daiquiri ', riff_of_id: null }])].sort(), ['d', 'n']);
assert.equal(haveClassics(classics, []).size, 0);

// --- classicsToAdd: ticked and not already there, so running it again adds nothing twice ---
assert.deepEqual(ids(classicsToAdd(classics, new Set(['m']), new Set(['n']))), ['d']);
assert.deepEqual(ids(classicsToAdd(classics, new Set(), new Set(['n', 'd', 'm']))), []);

// --- groupGlasses: runs of maker and range, in order ---
const cc = { display_name: 'Cocktail Kingdom' };
const lib = { display_name: 'Libbey' };
const glasses = [
  { name: 'Leopold Mini', series: 'Leopold', maker: cc },
  { name: 'Leopold 6oz', series: 'Leopold', maker: cc },
  { name: 'Coupette', series: null, maker: cc },
  { name: 'Perception', series: 'Perception', maker: lib },
];
assert.deepEqual(
  groupGlasses(glasses, 'range').map((g) => [g.title, g.models.length]),
  [
    ['Cocktail Kingdom · Leopold', 2],
    ['Cocktail Kingdom', 1],
    ['Libbey · Perception', 1],
  ]
);
assert.deepEqual(
  groupGlasses(glasses, 'maker').map((g) => [g.title, g.models.length]),
  [
    ['Cocktail Kingdom', 3],
    ['Libbey', 1],
  ]
);

// --- setupLine ---
assert.equal(setupLine({ invites: 3, claim: 'none', waitingFiles: 0 }), 'Set up · 3 invites sent · page private until it’s checked');
assert.equal(setupLine({ invites: 1, claim: 'pending', waitingFiles: 2 }), 'Set up · one invite sent · spec book being read · claim being checked');
assert.equal(setupLine({ invites: 0, claim: 'approved', waitingFiles: 0 }), 'Set up');

// --- glassMakers ---
const row = (maker: string | null, page?: string) => ({ maker, maker_page: page ? { display_name: page } : null });
assert.equal(glassMakers([row('Cocktail Kingdom'), row('Cocktail Kingdom'), row(null, 'Libbey')]), 'Cocktail Kingdom, Libbey');
assert.equal(glassMakers([row('A'), row('B'), row('C')]), 'A, B and more');
assert.equal(glassMakers([row(null)]), '');

console.log('whatNext checks passed');
