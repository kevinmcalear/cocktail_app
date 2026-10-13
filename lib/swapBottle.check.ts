import assert from 'node:assert/strict';

import { specLines } from './spec';
import { amountBox, amountEdit, bottlesFor, lineHits, oneLineSwapped, planSwap, swappedLines, type SwapDrink } from './swapBottle';

const drink = (id: string, itemType: SwapDrink['itemType'], lines: SwapDrink['lines']): SwapDrink => ({
  id,
  name: id,
  itemType,
  methodIds: ['stir'],
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

// --- one line, from the drink page ---
const raw = [
  { id: 'r1', ingredient_item_id: 'blended', amount: '2', unit: 'oz', preparation_notes: null, is_optional: false },
  { id: 'r2', ingredient_item_id: 'lemon', amount: 0.75, unit: 'oz', preparation_notes: 'fresh', is_optional: null },
];
const one = oneLineSwapped(raw, 'r1', 'ballantines');
assert.ok(one);
assert.equal(one[0].ingredient_item_id, 'ballantines');
assert.equal(one[0].amount, 2);
assert.equal(one[0].id, 'r1');
assert.deepEqual(one[1], { id: 'r2', ingredient_item_id: 'lemon', amount: 0.75, unit: 'oz', preparation_notes: 'fresh', is_optional: false });
// A bottle-only swap keeps the stored 2 oz exactly.
assert.equal(one[0].unit, 'oz');
const edited = oneLineSwapped(raw, 'r1', 'ballantines', { value: 45, unit: 'ml' });
assert.deepEqual([edited?.[0].amount, edited?.[0].unit], [45, 'ml']);
assert.equal(oneLineSwapped(raw, 'r1', 'ballantines', { value: null, unit: 'oz' })?.[0].amount, null);

// The amount box reads in the page's unit: 2 oz is 60 ml, as the spec line shows it.
const [twoOz, dash] = specLines([
  { id: 'r1', amount: 2, unit: 'oz', sort_order: 0, display_ingredient: { id: 'blended', name: 'Blended Scotch', abv: 40 } },
  { id: 'r2', amount: 2, unit: 'dash', sort_order: 1, display_ingredient: { id: 'ang', name: 'Angostura' } },
]);
const box = amountBox(twoOz, 'ml');
assert.deepEqual(box, { text: '60', unit: 'ml' });
assert.deepEqual(amountBox(twoOz, 'oz'), { text: '2', unit: 'oz' });
assert.deepEqual(amountBox(dash, 'ml'), { text: '2', unit: 'dash' });
// Untouched: nothing to save, so the stored 2 oz stays. Edited: saved in ml.
assert.equal(amountEdit(box, '60'), undefined);
assert.equal(amountEdit(box, ' 60.0 '), undefined);
assert.deepEqual(amountEdit(box, '45'), { value: 45, unit: 'ml' });
assert.deepEqual(amountEdit(amountBox(twoOz, 'oz'), '1 3/4'), { value: 1.75, unit: 'oz' });
assert.deepEqual(amountEdit(box, ''), { value: null, unit: 'ml' });
assert.equal(amountEdit(box, 'lots'), 'invalid');
assert.equal(oneLineSwapped(raw, 'gone', 'ballantines'), null);
assert.equal(oneLineSwapped([...raw, { ...raw[0], id: 'r3', ingredient_item_id: null }], 'r1', 'x'), null);

const catalog = [
  { id: 'scotch', name: 'Scotch', generic_id: 'whisky' },
  { id: 'blended', name: 'Blended Scotch', generic_id: 'scotch' },
  { id: 'ballantines', name: "Ballantine's", generic_id: 'blended' },
  { id: 'ardray', name: 'Ardray', generic_id: 'blended' },
  { id: 'house', name: 'House blend', generic_id: 'blended', bar_id: 'rye' },
  { id: 'theirs', name: 'Their blend', generic_id: 'blended', bar_id: 'moth' },
  { id: 'islay', name: 'Islay Scotch', generic_id: 'scotch' },
];
assert.deepEqual(bottlesFor('blended', catalog, 'rye').map((b) => b.id), ['house', 'ardray', 'ballantines']);
assert.deepEqual(bottlesFor('ardray', catalog, 'rye').map((b) => b.id), ['house', 'ballantines']);
assert.deepEqual(bottlesFor('islay', catalog, null).map((b) => b.id), ['blended']);
assert.deepEqual(bottlesFor('nothing', catalog, null), []);
