// Checks for lib/whatNext.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { anyKind, brandGroups, classicsToAdd, glassMakers, groupGlasses, haveClassics, heldGlassPlan, heldNotOnPage, setupLine, topClassics } from './whatNext';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

// --- topClassics: most rankers first, catalog order breaks ties, then n ---
const catalog = ['martini', 'negroni', 'old-fashioned', 'daiquiri', 'aviation', 'zombie'].map((id) => ({ id }));
assert.deepEqual(ids(topClassics(catalog, {}, 3)), ['martini', 'negroni', 'old-fashioned'], 'no rankings: the catalog order');
assert.deepEqual(ids(topClassics(catalog, { zombie: 40, daiquiri: 25, negroni: 25 }, 4)), ['zombie', 'negroni', 'daiquiri', 'martini'], 'ranked first, ties in catalog order');
assert.equal(topClassics(Array.from({ length: 405 }, (_, i) => ({ id: `c${i}` })), {}).length, 20, '20 by default');
assert.equal(topClassics(catalog, {}).length, 6, 'fewer than 20 in the catalog: all of them');
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
assert.equal(glassMakers([{ maker: null, maker_page: null, model: { maker: { display_name: 'Libbey' } } }]), 'Libbey', 'a catalog glass: its model’s maker');

// --- heldGlassPlan: each catalog glass once, first of a type the main one ---
const held = [
  { key: 'leo', glass: 'coupe', model_id: 'leo' },
  { key: 'perc', glass: 'coupe', model_id: 'perc' },
  { key: 'mine', glass: 'rocks', model_id: null },
  { key: 'nick', glass: 'nick', model_id: 'nick' },
];
const plan = heldGlassPlan(held, [{ glass: 'nick', model_id: 'nick', is_default: true }]);
assert.deepEqual(plan.skip, ['nick'], 'already on the page: not saved twice');
assert.deepEqual(plan.save.map((g) => [g.key, g.is_default]), [['leo', true], ['perc', false], ['mine', true]]);
assert.deepEqual(heldGlassPlan(held.slice(0, 1), [{ glass: 'coupe', model_id: 'other', is_default: true }]).save[0].is_default, false, 'the page has a main coupe: keep it');
assert.deepEqual(heldGlassPlan([], []), { save: [], skip: [] });
assert.deepEqual(heldNotOnPage(held, [{ model_id: 'nick' }]).map((g) => g.key), ['leo', 'perc', 'mine'], 'a glass on the page and held counts once');

// --- brandGroups: the starting kinds, what's stocked under each however deep, the rest under its own top kind ---
const ing = [
  { id: 'mezcal', name: 'Mezcal', ingredient_role: 'generic' },
  { id: 'espadin', name: 'Espadín mezcal', generic_id: 'mezcal', ingredient_role: 'generic' },
  { id: 'vida', name: 'Del Maguey Vida', generic_id: 'espadin', ingredient_role: 'product' },
  { id: 'gin', name: 'Gin', ingredient_role: 'generic' },
  { id: 'whiskey', name: 'Whiskey', ingredient_role: 'generic' },
  { id: 'irish', name: 'Irish whiskey', generic_id: 'whiskey', ingredient_role: 'generic' },
  { id: 'beer', name: 'Beer', ingredient_role: 'generic' },
  { id: 'lager', name: 'Lager', generic_id: 'beer', ingredient_role: 'generic' },
  { id: 'peroni', name: 'Peroni', generic_id: 'lager', ingredient_role: 'product' },
  { id: 'loop', name: 'Loop', generic_id: 'loop', ingredient_role: 'product' },
];
const shape = (gs: ReturnType<typeof brandGroups<(typeof ing)[number]>>) => gs.map((g) => [g.title, ids(g.kinds), ids(g.picked)]);
assert.deepEqual(shape(brandGroups(ing, [])), [
  ['Mezcal', ['mezcal'], []],
  ['Gin', ['gin'], []],
  ['Whiskey', ['whiskey'], []],
], 'nothing stocked: the starting kinds the catalog has (no bitter or amaro here)');
assert.deepEqual(shape(brandGroups(ing, ['vida', 'gin', 'irish', 'peroni', 'loop', 'gone'])), [
  ['Mezcal', ['mezcal'], ['vida']],
  ['Gin', ['gin'], []],
  ['Whiskey', ['whiskey'], ['irish']],
  ['Beer', ['beer'], ['peroni']],
  ['Loop', [], ['loop']],
], 'deep brands find their group, the plain one shows as its kind, a loop in the data stops');

assert.equal(anyKind('Bitter aperitivo'), 'Any bitter aperitivo');
assert.equal(anyKind('Mezcal'), 'Any mezcal');

console.log('whatNext checks passed');
