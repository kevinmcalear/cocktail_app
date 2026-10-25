// Checks for lib/whatNext.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { anyKind, brandGroups, classicsToAdd, haveClassics, heldGlassPlan, heldNotOnPage, topClassics } from './whatNext';

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
  { id: 'wine-stray', name: 'Wine', ingredient_role: null },
  { id: 'wine', name: 'Wine', ingredient_role: 'generic' },
];
const shape = (gs: ReturnType<typeof brandGroups<(typeof ing)[number]>>) => gs.map((g) => [g.title, ids(g.kinds), ids(g.picked)]);
assert.deepEqual(shape(brandGroups(ing, [])), [
  ['Gin', ['gin'], []],
  ['Mezcal', ['mezcal'], []],
  ['Whiskey', ['whiskey'], []],
  ['Wine', ['wine'], []],
  ['Beer', ['beer'], []],
], 'nothing stocked: the starting kinds the catalog has, in order; a stray row sharing a kind\'s name loses to the generic');
assert.deepEqual(shape(brandGroups(ing, ['vida', 'gin', 'irish', 'peroni', 'loop', 'gone'])), [
  ['Gin', ['gin'], []],
  ['Mezcal', ['mezcal'], ['vida']],
  ['Whiskey', ['whiskey'], ['irish']],
  ['Wine', ['wine'], []],
  ['Beer', ['beer'], ['peroni']],
  ['Loop', [], ['loop']],
], 'deep brands find their group, the plain one shows as its kind, a loop in the data stops');

assert.equal(anyKind('Bitter aperitivo'), 'Any bitter aperitivo');
assert.equal(anyKind('Mezcal'), 'Any mezcal');

console.log('whatNext checks passed');
