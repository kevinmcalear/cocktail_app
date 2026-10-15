// Checks for lib/discoverShelves.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { DiscoverDrink } from './discoverDrinks';
import { onePerBar, pickShelves, SHELF_MAX, topStyle, waysTitle } from './discoverShelves';

const drink = (id: string, barId: string, styles: string[] = []): DiscoverDrink => ({
  id,
  name: id,
  description: null,
  imageUrl: null,
  barId,
  bar: { name: barId, handle: barId, logo: null, locality: null, city: null },
  menu: { onNow: true, past: null, order: 0 },
  styles,
  pos: null,
  rank: 0,
  match: null,
  why: null,
  distance: null,
});
const ids = (ds: DiscoverDrink[]) => ds.map((d) => d.id);

// --- one drink per bar, in the order given, capped ---
assert.deepEqual(ids(onePerBar([drink('a1', 'a'), drink('a2', 'a'), drink('b1', 'b'), drink('c1', 'c')])), ['a1', 'b1', 'c1']);
const many = Array.from({ length: 14 }, (_, i) => drink(`d${i}`, `bar${i}`));
assert.equal(onePerBar(many).length, SHELF_MAX);

// --- the top style counts bars, not drinks; three bars at least; zero-proof never ---
const martinis = [drink('m1', 'a', ['martini']), drink('m2', 'a', ['martini']), drink('m3', 'a', ['martini']), drink('m4', 'b', ['martini'])];
const sours = [drink('s1', 'a', ['sour']), drink('s2', 'b', ['sour']), drink('s3', 'c', ['sour'])];
assert.equal(topStyle([...martinis, ...sours]), 'sour', 'four Martinis at two bars lose to sours at three');
assert.equal(topStyle(martinis), null, 'two bars is too few');
assert.equal(topStyle([drink('z1', 'a', ['zero-proof']), drink('z2', 'b', ['zero-proof']), drink('z3', 'c', ['zero-proof'])]), null, 'zero-proof has its own shelf');
const tie = [drink('n1', 'a', ['negroni']), drink('n2', 'b', ['negroni']), drink('n3', 'c', ['negroni']), drink('x1', 'a', ['martini']), drink('x2', 'b', ['martini']), drink('x3', 'c', ['martini'])];
assert.equal(topStyle(tie), 'martini', 'a tie goes to the chips order');
assert.equal(topStyle([drink('u1', 'a')]), null, 'no styles (a server before 20261028100000)');

const pageTwo = [...Array.from({ length: 30 }, (_, i) => drink(`p${i}`, 'a')), ...sours];
assert.equal(topStyle(pageTwo), null, 'only the first page counts, so Show more never swaps the shelf');

assert.equal(waysTitle('martini', 5), 'Martinis, five ways');
assert.equal(waysTitle('sour', 10), 'Sours, ten ways');

// --- shelves: in order, a shelf under three drinks hidden, titles from where ---
const around = [drink('a1', 'a'), drink('b1', 'b'), drink('c1', 'c'), drink('d1', 'd')];
const three = [drink('m1', 'a', ['martini']), drink('m2', 'b', ['martini']), drink('m3', 'c', ['martini'])];
const all = pickShelves({ where: 'near you', around, style: 'martini', styled: three, zero: three });
assert.deepEqual(
  all.map((s) => [s.title, s.kind]),
  [
    ['On menus around you', null],
    ['Martinis, three ways', 'martini'],
    ['Zero-proof near you', 'zero-proof'],
  ],
);
assert.equal(all[1].note, 'The style poured most around here');
const thin = pickShelves({ where: 'in Brooklyn', around, style: 'martini', styled: [drink('m1', 'a'), drink('m2', 'a'), drink('m3', 'b')], zero: [] });
assert.deepEqual(
  thin.map((s) => s.title),
  ['On menus in Brooklyn'],
  'three Martinis at two bars is two drinks after one per bar: hidden; no zero-proof: hidden',
);
assert.deepEqual(pickShelves({ where: 'near you', around: around.slice(0, 2), style: null, styled: [], zero: [] }), [], 'two bars: nothing');
