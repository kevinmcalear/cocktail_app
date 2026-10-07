// Checks for lib/barTopDrinks.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { pastMenuLabel, ratingCount, splitTopDrinks, toTopDrink, topDrinkCaption, topDrinkHref, topDrinkLabel, type BarTopDrink } from './barTopDrinks';

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
  menu_from: null,
  menu_to: null,
  ...over,
});

// PostgREST numerics arrive as strings.
const gimlet = toTopDrink(
  row({ item_id: 'a', name: 'House Gimlet', bar_id: 'bar1', ranked_as_name: 'Gimlet', position: 1, score: '8.4' as unknown as number, rankers: 64, menu: 'current', menu_from: 2026, menu_to: 2026 })
);
assert.equal(gimlet.score, 8.4);
assert.equal(gimlet.position, 1);

const early = row({ item_id: 'b', rankers: 3, menu: 'past', menu_from: 2024, menu_to: 2025 });
const fresh = row({ item_id: 'c', menu: 'past', menu_from: 2019, menu_to: 2019 });
const split = splitTopDrinks([gimlet, early, fresh]);
assert.deepEqual(split.scored.map((r) => r.item_id), ['a']);
assert.deepEqual(split.early.map((r) => r.item_id), ['b']);
assert.deepEqual(split.unranked.map((r) => r.item_id), ['c']);

assert.equal(ratingCount(1), '1 rating');
assert.equal(ratingCount(64), '64 ratings');

assert.equal(pastMenuLabel(early), 'Past · 2024 to 2025');
assert.equal(pastMenuLabel(fresh), 'Past · 2019');
assert.equal(pastMenuLabel(row({ item_id: 'd', menu: 'past' })), 'Past menu', 'a live menu with no dates');
assert.equal(pastMenuLabel(gimlet), null, 'on now is said in the caption, not a tag');

assert.equal(topDrinkCaption(gimlet), 'Gimlet · 64 ratings · on now');
assert.equal(topDrinkCaption(early), '3 ratings');
assert.equal(topDrinkCaption(fresh), '', 'nothing to say yet: no caption');

assert.equal(topDrinkLabel(gimlet), 'Number 1: House Gimlet, a Gimlet. Score 8.4 from 64 ratings. On the menu now');
assert.equal(topDrinkLabel(early), 'Drink b. 3 ratings, no score yet. Past menu, 2024 to 2025');
assert.equal(topDrinkLabel(row({ item_id: 'e' })), 'Drink e. Not rated yet');

assert.equal(topDrinkHref(gimlet), '/d/a', "a bar's own drink opens its published page");
assert.equal(topDrinkHref(fresh), '/cocktail/c', 'a signature opens the drink page');

console.log('barTopDrinks checks passed');
