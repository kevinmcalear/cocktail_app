import assert from 'node:assert/strict';

import { abvError, abvNumber, bottleFacts, bottleMatches, kindHelp, notABottleWords, ownBottle, savedDetail, takenWords } from './addBottle';

const rows = [
  { id: 'l10', name: 'Laphroaig 10', ingredient_role: 'product', brand_maker: 'Laphroaig', generic_id: 'islay' },
  { id: 'lqc', name: 'Laphroaig Quarter Cask', ingredient_role: 'product', brand_maker: 'Laphroaig', generic_id: 'islay' },
  { id: 'lsyrup', name: 'Laphroaig syrup', ingredient_role: 'prep' },
  { id: 'islay', name: 'Islay Scotch', ingredient_role: 'generic' },
  { id: 'other', name: 'Laphroaig Lore', ingredient_role: 'product', bar_id: 'other-bar' },
  { id: 'mine', name: 'House Gin', ingredient_role: 'product', bar_id: 'bar' },
];

// Is it this one? Bottles only (not house-mades or kinds), shared or this venue's, two at most.
assert.deepEqual(bottleMatches('Laphroaig 1', rows, 'bar').map((r) => r.id), ['l10']);
assert.deepEqual(bottleMatches('laphroaig', rows, 'bar').map((r) => r.id), ['l10', 'lqc']);
assert.deepEqual(bottleMatches('house', rows, 'bar').map((r) => r.id), ['mine']);
assert.deepEqual(bottleMatches('house', rows, null), []);
assert.deepEqual(bottleMatches('l', rows, null), []);
// "Tanq": the bottle called plain "Tanqueray" comes first, not the two shortest names (walk 12 Nov).
{
  const tanq = [
    { id: 'zero', name: 'Tanqueray 0.0%', ingredient_role: 'product' },
    { id: 'ten', name: 'Tanqueray No. Ten', ingredient_role: 'product' },
    { id: 'ldg', name: 'Tanqueray London Dry Gin', ingredient_role: 'product' },
    { id: 'rangpur', name: 'Tanqueray Rangpur Lime', ingredient_role: 'product' },
  ];
  const aliases = [
    { key: 'tanqueray', item_id: 'ldg' },
    { key: 'tanqueray gin', item_id: 'ldg' },
    { key: 'tanqueray 10', item_id: 'ten' },
    { key: 'tanqueray rangpur', item_id: 'rangpur' },
  ];
  assert.deepEqual(bottleMatches('Tanq', tanq, 'bar', { aliases }).map((r) => r.id), ['ldg', 'ten']);
  assert.deepEqual(bottleMatches('Tanq', tanq, 'bar').map((r) => r.id), ['zero', 'ten']); // no aliases: shortest names, as before
}

// A venue's own bottle by name, which the shared check can't see.
assert.equal(ownBottle('house gin', rows, 'bar')?.id, 'mine');
assert.equal(ownBottle('house gin', rows, null), null);

assert.equal(bottleFacts('Laphroaig', 40, 'Islay Scotch'), 'Laphroaig · 40% · Islay Scotch');
assert.equal(bottleFacts(null, 0, null), '0%');
assert.equal(bottleFacts(' ', null, 'Gin'), 'Gin');

// Name taken: where it is, then what to do.
assert.deepEqual(takenWords('Campari', true, { since: '2026-03-04T12:00:00Z', drinks: 6 }), {
  title: 'Campari is already here',
  body: 'On the back bar since March, in 6 drinks. Use that one, or give this bottle a name that tells them apart.',
});
assert.equal(takenWords('Campari', true, { since: null, drinks: 1 }).body.split('.')[0], 'On the back bar, in 1 drink');
assert.equal(takenWords('Campari', false, { since: null, drinks: 0 }).title, 'Campari is already on your shelf');

assert.equal(kindHelp('Islay Scotch', 'label'), 'Drinks that call for Islay Scotch can use it. Picked from the label; change it here.');
assert.equal(kindHelp('Gin', 'name'), 'Drinks that call for gin can use it. Picked from the name; change it here.');
assert.equal(kindHelp('Gin', 'catalog'), 'Drinks that call for gin can use it.');
assert.equal(savedDetail('bottles', 'Gin'), 'It’s on Bottles, and any drink that calls for gin can use it.');
assert.equal(savedDetail('shelf', null), 'It’s on your shelf.');
// A bar without its Bottles list (More drink filters off) isn't told it's on Bottles.
assert.equal(savedDetail('bar', 'Gin'), 'Any drink that calls for gin can use it.');
assert.equal(savedDetail('bar', null), 'Drinks here can use it now.');
assert.ok(!savedDetail('bar', 'Gin').includes('Bottles'));

assert.equal(abvNumber('40,5'), 40.5);
assert.equal(abvNumber(''), null);
assert.equal(abvNumber('140'), null);
assert.equal(abvNumber('.5'), 0.5);
assert.equal(abvNumber('40.'), 40);
assert.equal(abvNumber('100'), 100);
assert.equal(abvNumber('.'), null);
assert.equal(abvNumber(','), null);
assert.equal(abvNumber('40.5.1'), null);
// A strength that isn't one says so and blocks Save, rather than saving the bottle with none (review of #1181).
assert.equal(abvError(''), null);
assert.equal(abvError('43'), null);
assert.ok(abvError('400'));
assert.ok(abvError('.'));

assert.equal(notABottleWords('Simple Syrup', 'prep').body, 'It’s a house-made, not a bottle you buy. Open it, or give this bottle a name that tells them apart.');
assert.equal(notABottleWords('Gin', 'generic').title, 'Gin is already here');
