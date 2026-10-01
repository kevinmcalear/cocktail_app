import assert from 'node:assert/strict';

import { lineHits, planSwap, swappedLines, type SwapDrink } from './swapBottle';

const drink = (id: string, itemType: SwapDrink['itemType'], lines: SwapDrink['lines']): SwapDrink => ({
  id,
  name: id,
  itemType,
  methodId: 'stir',
  lines,
});
const line = (id: string, ingredientId: string | null, genericId: string | null, amount = 30): SwapDrink['lines'][number] => ({
  id,
  ingredientId,
  genericId,
  amount,
  unit: 'ml',
  notes: null,
  optional: false,
});

const drinks: SwapDrink[] = [
  drink('negroni', 'cocktail', [line('a', 'beef', 'gin'), line('b', 'campari', null)]),
  drink('gt', 'cocktail', [line('c', 'tanq', 'gin', 50)]),
  drink('french', 'cocktail', [line('d', 'roku', 'gin')]),
  drink('last', 'cocktail', [line('e', 'beef', 'gin', 22.5), line('f', 'chartreuse', null)]),
  drink('syrup', 'ingredient', [line('g', 'beef', 'gin', 200)]),
  drink('hidden', 'cocktail', [line('h', null, 'gin')]),
];
const names = { beef: 'Beefeater', tanq: 'Tanqueray', roku: 'Roku', campari: 'Campari', chartreuse: 'Chartreuse' };

const all = planSwap(drinks, 'gin', 'roku', 'kind', null, names, 'Roku');
assert.deepEqual(all.hits.map((hit) => hit.drink.id), ['negroni', 'gt', 'last']);
assert.deepEqual(all.houses.map((house) => house.id), ['syrup']);
assert.equal(all.hits[0].changes[0].from, 'Beefeater');
assert.equal(all.hits[0].changes[0].to, 'Roku');
assert.equal(all.hits[2].changes.length, 1);

const onMenu = planSwap(drinks, 'gin', 'roku', 'kind', new Set(['negroni', 'gt']), names, 'Roku');
assert.deepEqual(onMenu.hits.map((hit) => hit.drink.id), ['negroni', 'gt']);

const bottle = planSwap(drinks, 'beef', 'roku', 'bottle', null, names, 'Roku');
assert.deepEqual(bottle.hits.map((hit) => hit.drink.id), ['negroni', 'last']);

assert.equal(lineHits(line('a', 'roku', 'gin'), 'gin', 'roku', 'kind'), false);

const next = swappedLines(drinks[0], 'gin', 'roku', 'kind');
assert.equal(next[0].ingredient_item_id, 'roku');
assert.equal(next[0].id, 'a');
assert.equal(next[0].amount, 30);
assert.equal(next[1].ingredient_item_id, 'campari');
assert.equal(next[1].id, 'b');
