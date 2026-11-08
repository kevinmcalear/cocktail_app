import assert from 'node:assert/strict';

import { abvNumber, bottleFacts, bottleMatches, kindHelp, notABottleWords, ownBottle, savedDetail, takenWords } from './addBottle';

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
assert.equal(savedDetail(true, 'Gin'), 'It’s on Bottles, and any drink that calls for gin can use it.');
assert.equal(savedDetail(false, null), 'It’s on your shelf.');

assert.equal(abvNumber('40,5'), 40.5);
assert.equal(abvNumber(''), null);
assert.equal(abvNumber('140'), null);

assert.equal(notABottleWords('Simple Syrup', 'prep').body, 'It’s a house-made, not a bottle you buy. Open it, or give this bottle a name that tells them apart.');
assert.equal(notABottleWords('Gin', 'generic').title, 'Gin is already here');
