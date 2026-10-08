import assert from 'node:assert/strict';

import { familyFor, familyRows, pathTo, rowMeta, searchTree, type TreeNode } from './drinkTree';

const node = (key: string, family: string, parentKey: string | null, extra: Partial<TreeNode> = {}): TreeNode => ({
  key,
  id: key.slice(2),
  kind: key.startsWith('s:') ? 'style' : 'drink',
  name: key.slice(2),
  year: null,
  approx: false,
  family,
  parentKey,
  note: null,
  creator: null,
  creatorId: null,
  bar: null,
  barId: null,
  barClosed: false,
  versions: 0,
  ...extra,
});

const nodes = [
  node('s:punch', 'trunk', null, { year: 1632 }),
  node('s:sour', 'sour', 's:punch', { year: 1856 }),
  node('d:whiskey-sour', 'sour', 's:sour', { year: 1862 }),
  node('d:gold-rush', 'sour', 'd:whiskey-sour', { year: 2000 }),
  node('d:penicillin', 'sour', 'd:gold-rush', { name: 'Penicillin', year: 2005, creator: 'Sam Ross', bar: 'Milk & Honey' }),
  node('d:daiquiri', 'sour', 's:sour', { year: 1898, approx: true }),
  node('s:fizz', 'highball', 's:sour', { year: 1876 }),
  node('d:gin-fizz', 'highball', 's:fizz', { year: 1876 }),
];

// Parent first, children oldest first; the family's root notes its parent from another family.
const sour = familyRows(nodes, 'sour');
assert.deepEqual(
  sour.map((r) => [r.node.key, r.depth]),
  [
    ['s:sour', 0],
    ['d:whiskey-sour', 1],
    ['d:gold-rush', 2],
    ['d:penicillin', 3],
    ['d:daiquiri', 1],
  ]
);
assert.equal(sour[0].from?.key, 's:punch');
assert.equal(sour[0].hasKids, true);
assert.equal(sour.find((r) => r.node.key === 'd:penicillin')?.hasKids, false);
// Other families' children don't count as kids here.
assert.deepEqual(familyRows(nodes, 'highball').map((r) => r.node.key), ['s:fizz', 'd:gin-fizz']);
assert.equal(familyRows(nodes, 'highball')[0].from?.key, 's:sour');

// Folding hides what's under a node, not the node.
assert.deepEqual(familyRows(nodes, 'sour', new Set(['d:whiskey-sour'])).map((r) => r.node.key), ['s:sour', 'd:whiskey-sour', 'd:daiquiri']);

// A loop doesn't spin.
const loop = [node('d:a', 'sour', 'd:b'), node('d:b', 'sour', 'd:a')];
assert.ok(familyRows(loop, 'sour').length <= 2);
assert.ok(pathTo(loop, 'd:a').length <= 2);

assert.deepEqual(pathTo(nodes, 'd:penicillin'), ['s:punch', 's:sour', 'd:whiskey-sour', 'd:gold-rush', 'd:penicillin']);

// Search: name starts, then name contains, then maker or bar; accents ignored.
assert.deepEqual(searchTree(nodes, 'pen').map((n) => n.key), ['d:penicillin']);
assert.deepEqual(searchTree(nodes, 'sam ross').map((n) => n.key), ['d:penicillin']);
assert.deepEqual(searchTree([node('d:vieux', 'martini', null, { name: 'Vieux Carré' })], 'carre').map((n) => n.key), ['d:vieux']);
assert.deepEqual(searchTree(nodes, '  '), []);

assert.equal(rowMeta(nodes[4]), '2005 · Sam Ross · Milk & Honey');
assert.equal(rowMeta(node('d:x', 'sour', null, { year: 1898, approx: true, bar: 'Pegu Club', barClosed: true, versions: 1 })), 'c. 1898 · Pegu Club (closed) · 1 bar version');

assert.equal(familyFor(nodes, 'penicillin'), 'sour');
assert.equal(familyFor(nodes, 's:fizz'), 'highball');
assert.equal(familyFor(nodes, 'nope'), 'oldfashioned');
assert.equal(familyFor(nodes, null), 'oldfashioned');

console.log('drinkTree: ok');
