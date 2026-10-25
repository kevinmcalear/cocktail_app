import assert from 'node:assert/strict';

import { bottleLine, pourCount, pourersOf, stillPours, swapQuestion } from './backBarSwap';
import type { SwapDrink } from './swapBottle';
import type { MenuSummary } from '@/types/menus';

const line = (id: string, ingredientId: string | null, genericId: string | null = 'mezcal'): SwapDrink['lines'][number] => ({
  id,
  ingredientId,
  genericId,
  amount: 45,
  unit: 'ml',
  notes: null,
  optional: false,
});
const drink = (id: string, name: string, itemType: SwapDrink['itemType'], lines: SwapDrink['lines']): SwapDrink => ({ id, name, itemType, methodIds: [], lines });

const drinks: SwapDrink[] = [
  drink('smoke', 'Smoke Signal', 'cocktail', [line('a', 'vida')]),
  drink('batch', 'Ash Garden batch', 'ingredient', [line('b', 'vida'), line('c', 'agave', null)]),
  drink('negroni', 'Mezcal Negroni', 'cocktail', [line('d', 'vida'), line('e', 'campari', null)]),
  drink('naked', 'Naked and Famous', 'cocktail', [line('f', 'vida')]),
  drink('other', 'Paloma', 'cocktail', [line('g', 'montelobos')]),
  drink('plain', 'Oaxaca Old Fashioned', 'cocktail', [line('h', 'mezcal', null)]),
  drink('hidden', 'Secret', 'cocktail', [line('i', 'vida'), line('j', null, null)]),
  drink('trial', 'Trial', 'cocktail', [line('k', 'vida')]),
];
const names = { vida: 'Del Maguey Vida', montelobos: 'Montelobos Espadín', mezcal: 'Mezcal' };
const menu = (id: string, name: string, itemIds: string[], extra: Partial<MenuSummary>): MenuSummary =>
  ({ id, name, itemIds, kind: 'menu', startsAt: null, endsAt: null, menuDate: null, ...extra }) as MenuSummary;
const now = Date.parse('2026-10-22T20:00:00Z');
const menus = [
  menu('autumn', 'Autumn', ['negroni', 'naked'], { startsAt: '2026-09-01T00:00:00Z' }),
  menu('summer', 'Summer menu', ['smoke'], { startsAt: '2026-11-01T00:00:00Z' }),
  menu('rnd', 'Trials', ['trial', 'naked'], { kind: 'rnd' }),
];

// Only that bottle (not the plain kind, not the new one), the menu that's on first, preps last and swapped too.
const rows = pourersOf(drinks, 'vida', { id: 'montelobos', name: 'Montelobos Espadín' }, names, menus, now);
assert.deepEqual(
  rows.map((row) => row.hit.drink.id),
  ['negroni', 'naked', 'smoke', 'trial', 'batch'],
);
assert.equal(rows[0].detail, 'On the Autumn menu');
assert.equal(rows[2].detail, 'Coming up on the Summer menu');
assert.equal(rows[3].detail, 'R&D');
assert.equal(rows[4].house, true);
assert.equal(rows[4].detail, 'House-made · changes with the drinks');
assert.equal(rows[0].hit.changes[0].to, 'Montelobos Espadín');

// A drink on no menu says what it pours.
const loose = pourersOf(drinks, 'vida', null, names, [], now);
assert.equal(loose.find((row) => row.hit.drink.id === 'smoke')?.detail, '45 ml Del Maguey Vida');
assert.equal(loose.length, 5);

assert.equal(swapQuestion(rows), 'Your Mezcal Negroni uses this. Swap it?');
assert.equal(pourCount(rows), '4 drinks and 1 house-made ingredient');
assert.equal(pourCount(rows.slice(4)), '1 house-made ingredient');
assert.equal(stillPours(rows.slice(0, 2)), '2 drinks still pour it: Mezcal Negroni and Naked and Famous.');
assert.equal(stillPours(rows), '4 drinks and 1 house-made ingredient still pour it: Mezcal Negroni, Naked and Famous, Smoke Signal, Trial and 1 more.');
assert.equal(stillPours(rows.slice(4)), '1 house-made ingredient still pours it: Ash Garden batch.');
assert.equal(bottleLine('Mezcal', 'Top shelf, left', rows), 'Mezcal · Top shelf, left · used in 4 drinks and 1 house-made ingredient');
assert.equal(bottleLine(null, '  ', []), '');

console.log('backBarSwap checks passed');
