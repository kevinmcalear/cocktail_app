import assert from 'node:assert/strict';

import { inMenuQuery, pagerPlace } from './menuPager';

const d = (id: string) => ({ id, name: id.toUpperCase() });
const menu = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(d);

const p = pagerPlace('Autumn', menu, 'd')!;
assert.equal(p.label, 'Autumn · 4 of 8');
assert.equal(p.prev?.id, 'c');
assert.equal(p.next?.id, 'e');

// The ends have one neighbour.
assert.equal(pagerPlace('Autumn', menu, 'a')!.prev, null);
assert.equal(pagerPlace('Autumn', menu, 'h')!.next, null);

// A drink listed twice counts once, at its first place.
const twice = pagerPlace('Autumn', [d('a'), d('b'), d('a'), d('c')], 'c')!;
assert.equal(twice.label, 'Autumn · 3 of 3');
assert.equal(twice.prev?.id, 'b');

// Not on the menu, or the only drink on it: no pager.
assert.equal(pagerPlace('Autumn', menu, 'z'), null);
assert.equal(pagerPlace('Autumn', [d('a')], 'a'), null);

// A guest sees all 8 listed but can open only some: the count is still of 8 (the 3rd is "3 of 8"), and ‹ › skip the ones they can't open.
const open = new Set(['a', 'c', 'f']);
const guest = pagerPlace('Autumn', menu, 'c', (x) => open.has(x.id))!;
assert.equal(guest.label, 'Autumn · 3 of 8');
assert.equal(guest.index, 2);
assert.equal(guest.total, 8);
assert.equal(guest.prev?.id, 'a');
assert.equal(guest.next?.id, 'f');
assert.equal(pagerPlace('Autumn', menu, 'f', (x) => open.has(x.id))!.next, null);

assert.equal(inMenuQuery('m1'), 'menu=m1');
assert.equal(inMenuQuery('m1', 'little-rye'), 'menu=m1&bar=little-rye');
