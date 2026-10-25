import assert from 'node:assert/strict';

import { gotLine, juiceFruit, listOpens, menuShopping, opensWith, shoppingGroups, shoppingSummary, shoppingText, shopFor, whyLine, type ShoppingRow } from './shoppingList';

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

// --- a juice adds the fruit it's squeezed from ---
assert.equal(juiceFruit('Lemon juice')?.label, 'Lemons');
assert.equal(juiceFruit('pink grapefruit juice')?.label, 'Grapefruit');
assert.equal(juiceFruit('Lime cordial'), null);
assert.equal(juiceFruit('Pineapple juice'), null);
