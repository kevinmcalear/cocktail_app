import assert from 'node:assert/strict';

import { barsCrediting, groupMenuCredits, parseProfileRef, type MenuDrinkRow } from './profiles';

// Ids and handles, with or without the @; junk never reaches a query.
assert.deepEqual(parseProfileRef('3F2504E0-4F89-41D3-9A0C-0305E82C3301'), { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' });
assert.deepEqual(parseProfileRef('@Juniper.Jo'), { handle: 'juniper.jo' });
assert.deepEqual(parseProfileRef(['little_rye', 'extra']), { handle: 'little_rye' });
assert.equal(parseProfileRef(''), null);
assert.equal(parseProfileRef(undefined), null);
assert.equal(parseProfileRef('a'), null);
assert.equal(parseProfileRef('bad handle'), null);
assert.equal(parseProfileRef('.dot'), null);
assert.equal(parseProfileRef('x,id.eq.1'), null);

const menu = (id: string, name: string, active: boolean, barId: string | null, barName: string | null) => ({
  id,
  name,
  is_active: active,
  bar_id: barId,
  bar: barName ? { name: barName } : null,
});
const rows: MenuDrinkRow[] = [
  { item_id: 'd1', menu: menu('m1', 'Spring', false, 'b1', 'Little Rye') },
  { item_id: 'd1', menu: menu('m2', 'Autumn', true, 'b1', 'Little Rye') },
  { item_id: 'd2', menu: menu('m2', 'Autumn', true, 'b1', 'Little Rye') },
  { item_id: 'd2', menu: menu('m2', 'Autumn', true, 'b1', 'Little Rye') },
  { item_id: 'd3', menu: menu('m3', 'Night garden', true, 'b2', 'Pale Moth') },
  { item_id: 'd4', menu: null },
];
const credits = groupMenuCredits(rows);
// Current menus first (by bar), past ones after; a drink listed twice counts once.
assert.deepEqual(
  credits.map((c) => [c.menuName, c.current, c.itemIds]),
  [
    ['Autumn', true, ['d1', 'd2']],
    ['Night garden', true, ['d3']],
    ['Spring', false, ['d1']],
  ]
);
assert.equal(barsCrediting(credits), 2);
assert.equal(barsCrediting(credits.filter((c) => !c.current)), 0);
assert.deepEqual(groupMenuCredits([]), []);

console.log('profiles: ok');
