// Checks for lib/whatNext.ts ("This is your bar. What next?"). Run: npm run test:unit
import assert from 'node:assert/strict';

import { STARTER_CLASSICS, groupGlasses, makersLine, nextStep, setupLine, starterClassics, stepProgress } from './whatNext';

// Twenty classics, none twice.
assert.equal(STARTER_CLASSICS.length, 20);
assert.equal(new Set(STARTER_CLASSICS).size, 20);

// In the list's order, matched by folded name; the catalogue's missing ones are left out.
const catalog = [
  { id: 'n', name: 'Negroni' },
  { id: 'm', name: 'martini' },
  { id: 'v', name: 'Vesper' },
  { id: 'f', name: 'French 75' },
  { id: 'n2', name: 'Negroni' },
];
assert.deepEqual(
  starterClassics(catalog).map((c) => c.id),
  ['m', 'n', 'f']
);

// The next step: the first not done or skipped.
assert.equal(nextStep([]), 'glasses');
assert.equal(nextStep(['glasses']), 'menu');
assert.equal(nextStep(['menu', 'glasses']), null);
assert.deepEqual(stepProgress('menu'), { at: 2, of: 2, label: '2 of 2 · Menu', name: 'What next' });

// A search groups by range, a shape by maker, in the order they came.
const ck = { display_name: 'Cocktail Kingdom' };
const libbey = { display_name: 'Libbey' };
const models = [
  { id: '1', series: 'Leopold', maker: ck },
  { id: '2', series: 'Leopold', maker: ck },
  { id: '3', series: 'Perception', maker: libbey },
  { id: '4', series: null, maker: libbey },
];
assert.deepEqual(
  groupGlasses(models, 'range').map((g) => [g.title, g.models.map((m) => m.id)]),
  [
    ['Cocktail Kingdom · Leopold', ['1', '2']],
    ['Libbey · Perception', ['3']],
    ['Libbey', ['4']],
  ]
);
assert.deepEqual(
  groupGlasses(models, 'maker').map((g) => [g.title, g.models.length]),
  [
    ['Cocktail Kingdom', 2],
    ['Libbey', 2],
  ]
);

// The summary in a line.
assert.equal(setupLine({ invites: 3, claim: 'none', waitingFiles: 0 }), 'Set up · 3 invites sent · page private until it’s checked');
assert.equal(setupLine({ invites: 1, claim: 'pending', waitingFiles: 2 }), 'Set up · one invite sent · spec book waiting · claim being checked');
assert.equal(setupLine({ invites: 0, claim: 'approved', waitingFiles: 0 }), 'Set up');

// Who makes the bar's glasses, each once.
assert.equal(makersLine([{ maker: 'Cocktail Kingdom' }, { maker: 'Libbey' }, { maker: 'Cocktail Kingdom' }, { maker: null }]), 'Cocktail Kingdom, Libbey');
assert.equal(makersLine([{ maker: null }]), null);
