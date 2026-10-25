import assert from 'node:assert/strict';

import { gotLine, handRow, listOpens, madeFrom, madeFromLine, staplesFrom, menuShopping, opensWith, shoppingGroups, shoppingSummary, shoppingText, shopFor, shopName, whyLine, type ShoppingRow } from './shoppingList';

const oneAway = [
  { bottles: [{ id: 'vermouth', name: 'Sweet vermouth' }], drinks: [{ id: 'blvd', name: 'Boulevardier' }, { id: 'fan', name: 'Fanciulli' }, { id: 'amer', name: 'Americano' }, { id: 'mt', name: 'Milano-Torino' }] },
  { bottles: [{ id: 'cynar', name: 'Cynar' }], drinks: [{ id: 'signal', name: 'Smoke Signal' }] },
];
const twoAway = [{ bottles: [{ id: 'cynar', name: 'Cynar' }, { id: 'rye', name: 'Rye whiskey' }], drinks: [{ id: 'toronto', name: 'Toronto' }] }];
const row = (over: Partial<ShoppingRow> & { id: string; name: string }): ShoppingRow => ({ itemId: over.id, source: 'hand', forName: null, section: 'bottles', imageUrl: null, gotAt: null, ...over });

// --- where it's bought ---
assert.equal(shopFor('bottles'), 'Bottle shop');
assert.equal(shopFor('fridge'), 'Grocer');
assert.equal(shopFor('lab'), 'Online or a cook’s shop');

// --- why it's on the list ---
assert.equal(whyLine({ source: 'running_low', forName: null }, []), 'Running low');
assert.equal(whyLine({ source: 'drink', forName: 'Smoke Signal' }, []), 'For Smoke Signal');
assert.equal(whyLine({ source: 'one_away', forName: null }, opensWith('vermouth', oneAway)), 'Opens 4 drinks: Boulevardier, Fanciulli +2');
assert.equal(whyLine({ source: 'hand', forName: null }, opensWith('cynar', oneAway)), 'For Smoke Signal');
assert.equal(whyLine({ source: 'hand', forName: null }, []), 'Added by you');
assert.deepEqual(opensWith(null, oneAway), []);

// --- groups: by shop in shop order, or by drink ---
const rows = [
  row({ id: 'eggs', name: 'Eggs', section: 'fridge', source: 'running_low' }),
  row({ id: 'cynar', name: 'Cynar', source: 'drink', forName: 'Smoke Signal' }),
  row({ id: 'citric', name: 'Citric acid', section: 'lab' }),
  row({ id: 'vermouth', name: 'Sweet vermouth', source: 'one_away' }),
];
assert.deepEqual(shoppingGroups(rows, 'shop', oneAway).map((g) => [g.title, g.rows.map((r) => r.name)]), [
  ['Bottle shop', ['Cynar', 'Sweet vermouth']],
  ['Grocer', ['Eggs']],
  ['Online or a cook’s shop', ['Citric acid']],
]);
assert.deepEqual(shoppingGroups(rows, 'drink', oneAway).map((g) => g.title), ['Restock', 'Smoke Signal', 'Added by you', 'Boulevardier, Fanciulli +2']);

// --- what the list opens: one away for a listed bottle, two away when both are listed ---
assert.equal(listOpens(rows, oneAway, twoAway), 5);
assert.equal(listOpens([...rows, row({ id: 'rye', name: 'Rye whiskey' })], oneAway, twoAway), 6);
assert.equal(shoppingSummary(4, 5), '4 to get · they open 5 more drinks');
assert.equal(shoppingSummary(1, 1), '1 to get · it opens 1 more drink');
assert.equal(shoppingSummary(2, 0), '2 to get');
assert.equal(shoppingSummary(0, 0), 'All done. Everything is on your shelf.');

// --- the Undo toast ---
assert.equal(gotLine({ itemId: 'cynar', source: 'drink', section: 'bottles' }, opensWith('cynar', oneAway)), 'On your shelf. Smoke Signal is ready.');
assert.equal(gotLine({ itemId: 'vermouth', source: 'one_away', section: 'bottles' }, opensWith('vermouth', oneAway)), 'On your shelf. 4 more drinks are ready.');
assert.equal(gotLine({ itemId: 'eggs', source: 'running_low', section: 'fridge' }, []), 'Restocked. Running low is off.');
assert.equal(gotLine({ itemId: null, source: 'hand', section: 'fridge' }, []), 'Crossed off.');

// --- Share's text ---
assert.equal(
  shoppingText(shoppingGroups(rows, 'shop', oneAway)),
  'Shopping, from Cocktail\n\nBottle shop\nCynar\nSweet vermouth\n\nGrocer\nEggs\n\nOnline or a cook’s shop\nCitric acid'
);

// --- a home menu's shopping: each short drink's bottles, once ---
assert.deepEqual(menuShopping([{ id: 'signal' }, { id: 'toronto' }, { id: 'sour' }], oneAway, twoAway), [
  { itemId: 'cynar', name: 'Cynar', forItemId: 'signal' },
  { itemId: 'rye', name: 'Rye whiskey', forItemId: 'toronto' },
]);

// --- add by hand: a house-made thing adds what it's made from ---
// As the local catalog has them: lemon juice and lime peel are kinds of Lemon and Lime, with no recipe of their own.
const recipes = {
  cordial: { lines: [{ id: 'sugar', name: 'Sugar' }, { id: 'lime-juice', name: 'Lime juice' }, { id: 'lime-peel', name: 'Lime Peel' }] },
  syrup: { lines: [{ id: 'water', name: 'Water' }, { id: 'sugar', name: 'Sugar' }] },
  oleo: { lines: [{ id: 'syrup', name: 'Simple syrup' }, { id: 'orgeat', name: 'Orgeat' }] },
  orgeat: { lines: [{ id: 'almond', name: 'Almonds' }] },
};
const lemon = { id: 'lemon', name: 'Lemon' };
const lime = { id: 'lime', name: 'Lime' };
const pantry = [lemon, lime, { id: 'soda', name: 'Soda Water' }, { id: 'water', name: 'Water' }];
const staples = staplesFrom(
  [{ id: 'lemon-juice', name: 'Lemon juice' }, { id: 'lime-juice', name: 'Lime juice' }, { id: 'lime-peel', name: 'Lime Peel' }, { id: 'topo', name: 'Topo Chico' }, { id: 'lemon', name: 'Lemon' }],
  { 'lemon-juice': 'lemon', 'lime-juice': 'lime', 'lime-peel': 'lime', topo: 'soda', lemon: null },
  pantry
);
// Only what's squeezed or cut from a staple: a soda brand filed under Soda Water stays a thing to buy.
assert.deepEqual(staples, { 'lemon-juice': lemon, 'lime-juice': lime, 'lime-peel': lime });
assert.equal(shopName('Lime'), 'Limes');
assert.equal(shopName('Cynar'), 'Cynar');
const lemons = madeFrom('lemon-juice', recipes, new Set(), staples);
assert.deepEqual(lemons, [{ id: 'lemon', name: 'Lemons' }]);
assert.equal(madeFromLine('Lemon juice', lemons, true), 'Squeezed from lemons, so adds Lemons');
assert.equal(madeFromLine('Egg white', [{ name: 'Eggs' }], true), 'Comes from eggs, so adds Eggs');
assert.deepEqual(madeFrom('lemon-juice', recipes, new Set(['lemon']), staples), []);
// A cordial: its sugar, and limes once for both its juice and its peel.
const cordial = madeFrom('cordial', recipes, new Set(), staples);
assert.deepEqual(cordial, [{ id: 'sugar', name: 'Sugar' }, { id: 'lime', name: 'Limes' }]);
assert.equal(madeFromLine('Lime cordial', cordial), 'House-made: adds Sugar and Limes');
assert.deepEqual(madeFrom('cordial', recipes, new Set(['sugar']), staples), [{ id: 'lime', name: 'Limes' }]);
assert.equal(madeFromLine('Lime cordial', madeFrom('cordial', recipes, new Set(['sugar', 'lime']), staples)), 'House-made. You have what goes in it');
// Never water; a house-made part by its parts, two deep only.
assert.deepEqual(madeFrom('syrup', recipes, new Set(), staples), [{ id: 'sugar', name: 'Sugar' }]);
assert.deepEqual(madeFrom('oleo', recipes, new Set(), staples), [{ id: 'sugar', name: 'Sugar' }, { id: 'almond', name: 'Almonds' }]);
// Its why line: the drinks it opens, else the thing it's for.
assert.equal(whyLine({ source: 'hand', forName: 'Lemon juice' }, [{ name: 'Hanky Panky' }, { name: 'Daiquiri' }]), 'Opens 2 drinks: Hanky Panky, Daiquiri');
assert.equal(whyLine({ source: 'hand', forName: 'Lemon juice' }, []), 'For Lemon juice');
assert.equal(whyLine({ source: 'drink', forName: 'Smoke Signal' }, [{ name: 'Hanky Panky' }, { name: 'Daiquiri' }]), 'For Smoke Signal');

// --- an Add by hand row ---
const ctx = (shelf: string[]) => ({ onShelf: new Set(shelf), have: new Set(shelf), recipes, staples });
const juice = { id: 'lemon-juice', name: 'Lemon juice', section: 'fridge' as const };
assert.deepEqual(handRow(juice, ctx([])), { note: 'Squeezed from lemons, so adds Lemons', label: 'Add', say: 'Add Lemons for Lemon juice', adds: [{ itemId: 'lemon', name: 'Lemons', source: 'hand', forItemId: 'lemon-juice' }] });
// Lemons on the shelf: lemon juice marks them running low, it never lists "Lemon juice".
assert.deepEqual(handRow(juice, ctx(['lemon'])), { note: 'From lemons, so it can mark yours running low', label: 'Running low', say: 'Mark Lemons running low', adds: [{ itemId: 'lemon', name: 'Lemons', source: 'running_low' }] });
assert.equal(handRow({ id: 'cordial', name: 'Lime cordial', section: 'preps' }, ctx([])).note, 'House-made: adds Sugar and Limes');
assert.equal(handRow({ id: 'cordial', name: 'Lime cordial', section: 'preps' }, ctx(['sugar', 'lime'])).adds[0].itemId, 'cordial');
// Nothing loaded yet: a plain row that adds the thing itself.
assert.deepEqual(handRow({ id: 'cordial', name: 'Lime cordial', section: 'preps' }, { onShelf: new Set(), have: new Set(), recipes: {}, staples: {} }).adds, [{ itemId: 'cordial', name: 'Lime cordial', source: 'hand' }]);
assert.equal(handRow({ id: 'gin', name: 'Gin', section: 'bottles' }, ctx(['gin'])).label, 'Running low');
