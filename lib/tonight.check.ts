// Checks for lib/tonight.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { bestAway, enoughRows, offTonight, oneBottleLine, onShiftLine, prepLine, runThroughMinutes, serviceEnd, shelfTiles, talkThrough, tonightEyebrow, unpriced } from './tonight';

// The night runs to 6am: at 1am it is still last night's.
assert.equal(serviceEnd(new Date(2026, 10, 1, 20)).getTime(), new Date(2026, 10, 2, 6).getTime());
assert.equal(serviceEnd(new Date(2026, 10, 2, 1)).getTime(), new Date(2026, 10, 2, 6).getTime());

const now = new Date(2026, 10, 1, 17);
const off = offTonight(
  [
    { id: 'a', offAt: null },
    { id: 'b', offAt: new Date(2026, 10, 1, 23).toISOString() },
    { id: 'c', offAt: new Date(2026, 10, 3, 23).toISOString() },
  ],
  now
);
assert.deepEqual(off.map((d) => d.id), ['b'], 'only a take-off before 6am counts as off tonight');

assert.equal(tonightEyebrow(now, 'opens 6pm', 'en-GB'), 'Sunday 1 November · doors at 6pm');
assert.equal(tonightEyebrow(now, 'opens 6pm Thu', 'en-GB'), 'Sunday 1 November', 'doors another day are not tonight');
assert.equal(tonightEyebrow(now, null, 'en-GB'), 'Sunday 1 November');

assert.equal(prepLine({ have: 'have 200 ml', needed: '600 ml', forDrinks: ['Jack Rose'] }), 'Low · 200 ml left, Jack Rose needs it');
assert.equal(prepLine({ have: null, needed: '1.5 L', forDrinks: ['back to par', 'Daiquiri'] }), 'Make 1.5 L · Daiquiri needs it');
assert.equal(prepLine({ have: null, needed: '1 L', forDrinks: ['back to par'] }), 'Make 1 L · back to par');

const lastWord = { id: 'lw', name: 'Last Word' };
assert.equal(oneBottleLine([{ name: 'Green Chartreuse' }], [lastWord, { id: 'x', name: 'Bijou' }]), 'Buy Green Chartreuse and you can make 2 more, the Last Word first.');
assert.equal(oneBottleLine([{ name: 'Green Chartreuse' }], [lastWord]), 'Buy Green Chartreuse and you can make the Last Word.');
assert.equal(oneBottleLine([], [lastWord]), null);

const small = { bottles: [{ name: 'Campari' }], drinks: [lastWord] };
const big = { bottles: [{ name: 'Green Chartreuse' }], drinks: [lastWord, lastWord, lastWord] };
const two = { bottles: [{ name: 'A' }, { name: 'B' }], drinks: [lastWord, lastWord, lastWord, lastWord] };
assert.equal(bestAway([small, big, two]), big, 'the single bottle that opens the most');
assert.equal(bestAway([]), null);

const ready = ['Negroni', 'Aperol Spritz', 'Bee’s Knees', 'Martini'].map((name) => ({ id: name, name }));
const tiles = shelfTiles(ready, [{ bottles: [{ name: 'Fresh lime juice' }], drinks: [{ id: 'd', name: 'Daiquiri' }] }], 4);
assert.deepEqual(
  tiles.map((t) => `${t.name}: ${t.status}`),
  ['Negroni: Ready', 'Aperol Spritz: Ready', 'Bee’s Knees: Ready', 'Daiquiri: Need limes']
);
assert.equal(shelfTiles(ready, [], 4).length, 4, 'all ready when nothing is one away');
assert.equal(shelfTiles([], [{ bottles: [{ name: 'Campari' }], drinks: [{ id: 'n', name: 'Negroni' }] }], 4)[0].status, 'Need Campari');

assert.equal(runThroughMinutes('Blended Scotch, lemon, honey-ginger, Islay float'), 1);
assert.equal(runThroughMinutes('Gin, Campari, sweet vermouth, orange, soda, bitters'), 2);
assert.equal(runThroughMinutes(''), 1);

const drinkList = [
  { id: 'pen', name: 'Penicillin' },
  { id: 'clover', name: 'Clover Club' },
];
const found: Record<string, { allergen: string; via: string[][] }[]> = {
  pen: [{ allergen: 'sulphites', via: [['Islay float']] }],
  clover: [{ allergen: 'eggs', via: [['Raw egg white']] }],
};
assert.deepEqual(
  talkThrough(drinkList, (id) => found[id], (k) => k),
  { id: 'clover', name: 'Clover Club', sub: 'Raw egg white: what to tell guests' },
  'eggs lead, named by the ingredient they come through'
);
assert.equal(talkThrough(drinkList, () => undefined, (k) => k), null);
assert.equal(talkThrough([{ id: 'x', name: 'X' }], () => [{ allergen: 'milk', via: [] }], () => 'Milk')?.sub, 'Milk: what to tell guests');
assert.deepEqual(
  enoughRows(['hg', 'gren', 'none'], [{ id: 'gren' }], { hg: { value: 1200 }, gren: { value: 200 } }, (id) => ({ hg: 'Honey-ginger syrup', gren: 'Grenadine', none: 'Orgeat' })[id], () => '1.2 L'),
  [{ id: 'hg', name: 'Honey-ginger syrup', sub: '1.2 L · enough for tonight' }],
  'only counted house-made that needs no batch'
);

assert.equal(unpriced([{ price: null }, { price: '18' }, { price: null, menuPrice: '20' }], (d) => d.menuPrice ?? d.price), 1);

const names: Record<string, string> = { ana: 'Ana Ruiz', theo: 'Theo Park', me: 'Kevin M' };
assert.deepEqual(
  onShiftLine([{ user_id: 'me', opens: false, closes: true }, { user_id: 'ana', opens: false, closes: false }, { user_id: 'theo', opens: true, closes: false }], (id) => names[id], 'me'),
  { names: 'Ana, Theo and you', sub: 'Theo opens · you close' }
);
assert.deepEqual(onShiftLine([{ user_id: 'ana', opens: false, closes: false }], (id) => names[id], 'me'), { names: 'Ana', sub: null });
assert.equal(onShiftLine([], (id) => names[id], 'me'), null);
