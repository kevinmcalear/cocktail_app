// Checks for lib/barTopDrinks.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { splitTopDrinks, toTopDrink, topDrinkCaption, topDrinkHref, topDrinkLabel, type BarTopDrink } from './barTopDrinks';

const row = (over: Partial<BarTopDrink> & { item_id: string }): BarTopDrink => ({
  position: null,
  name: `Drink ${over.item_id}`,
  bar_id: null,
  ranked_as_item_id: over.item_id,
  ranked_as_name: null,
  image_url: null,
  image_is_generated: null,
  score: null,
  rankers: 0,
  menu: null,
  ...over,
});

// PostgREST numerics arrive as strings.
const gimlet = toTopDrink(
  row({ item_id: 'a', name: 'House Gimlet', bar_id: 'bar1', ranked_as_name: 'Gimlet', position: 1, score: '8.4' as unknown as number, rankers: 22, menu: 'current' })
);
assert.equal(gimlet.score, 8.4);
assert.equal(gimlet.position, 1);

const early = row({ item_id: 'b', rankers: 3 });
const fresh = row({ item_id: 'c', menu: 'past' });
const split = splitTopDrinks([gimlet, early, fresh]);
assert.deepEqual(split.scored.map((r) => r.item_id), ['a']);
assert.deepEqual(split.early.map((r) => r.item_id), ['b']);
assert.deepEqual(split.unranked.map((r) => r.item_id), ['c']);

assert.equal(topDrinkCaption(gimlet), 'Gimlet · 22 people ranked');
assert.equal(topDrinkCaption(row({ item_id: 'd', rankers: 1 })), '1 person ranked');
assert.equal(topDrinkCaption(fresh), '', 'nothing to say yet: no caption');

assert.equal(topDrinkLabel(gimlet), 'Number 1: House Gimlet, a Gimlet. Score 8.4, 22 people ranked. On the menu');
assert.equal(topDrinkLabel(early), 'Drink b. 3 people ranked');
assert.equal(topDrinkLabel(fresh), 'Drink c. Not ranked yet. Past menu');

assert.equal(topDrinkHref(gimlet), '/d/a', "a bar's own drink opens its published page");
assert.equal(topDrinkHref(fresh), '/cocktail/c', 'a signature opens the drink page');

console.log('barTopDrinks checks passed');
