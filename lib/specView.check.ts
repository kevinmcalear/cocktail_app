// Checks for lib/specView.ts: the sticky Ingredients | Steps pick, Makes
// scaling on jigger marks, and grouping by step. Run: npm run test:unit
import assert from 'node:assert/strict';

import { specLines } from './spec';
import { defaultSpecView, methodVerb, pickSpecView, scaledAmount, serveLine, snapToJigger, specGroups } from './specView';

// Who is looking decides the default; a person's own pick sticks over it.
assert.equal(defaultSpecView(true), 'steps');
assert.equal(defaultSpecView(false), 'ingredients');
assert.equal(pickSpecView({}, 'me', true), 'steps');
assert.equal(pickSpecView({ me: 'ingredients' }, 'me', true), 'ingredients', 'my pick wins over the maker default');
assert.equal(pickSpecView({ someoneElse: 'ingredients' }, 'me', true), 'steps', 'per person: another person on this device keeps theirs');

// Jigger marks: quarter ounces, 2.5 ml under 30, 5 ml from 30, whole grams; never to zero.
assert.equal(snapToJigger(44, 'ml'), 45);
assert.equal(snapToJigger(22, 'ml'), 22.5);
assert.equal(snapToJigger(66, 'ml'), 65);
assert.equal(snapToJigger(1, 'ml'), 2.5);
assert.equal(snapToJigger(2.3, 'oz'), 2.25);
assert.equal(snapToJigger(0.1, 'oz'), 0.25);
assert.equal(snapToJigger(52.6, 'g'), 53);

const row = (id: string, name: string, amount: number, unit: string, extra: Record<string, unknown> = {}) => ({ id, amount, unit, display_ingredient_id: id, display_ingredient: { id, name, abv: null }, ...extra });
const penicillin = specLines([
  row('a', 'Blended Scotch', 60, 'ml'),
  row('b', 'Lemon juice', 22, 'ml'),
  row('c', 'Honey-ginger syrup', 22, 'ml'),
  row('d', 'Islay Scotch', 7.5, 'ml', { is_float: true }),
  row('e', 'Candied ginger', 1, 'each'),
]);

// Makes 1 reads as written; Makes 2 and 3 scale and land on the marks.
assert.equal(scaledAmount(penicillin[1], 1, 'ml'), '22 ml', 'one serve stays as written');
assert.equal(scaledAmount(penicillin[1], 2, 'ml'), '45 ml', '44 ml is not a mark: 45');
assert.equal(scaledAmount(penicillin[0], 3, 'ml'), '180 ml');
assert.equal(scaledAmount(penicillin[3], 3, 'ml'), '22.5 ml');
assert.equal(scaledAmount(penicillin[4], 2, 'ml'), '2 each', 'a garnish count multiplies as written');
assert.equal(scaledAmount(penicillin[0], 2, 'oz'), '4 oz', '120 ml reads as 4 oz on the jigger');
const ozLine = specLines([row('o', 'Gin', 0.75, 'oz')])[0];
assert.equal(scaledAmount(ozLine, 2, 'ml'), '45 ml', 'three quarters of an ounce is 22.5 ml a serve, so 45 ml for two');
assert.equal(scaledAmount(ozLine, 3, 'oz'), '2.25 oz');

// Steps: the main pour titled by its method, the float, then the garnish under no heading.
const groups = specGroups(penicillin, methodVerb(['Shaken']));
assert.deepEqual(groups.map((g) => [g.number, g.title, g.lines.length, g.tag ?? null]), [
  ['1', 'Shake', 3, null],
  ['2', 'Float', 1, null],
  [null, null, 1, 'Garnish'],
]);
// A simple drink is one group.
assert.equal(specGroups(penicillin.slice(0, 3), 'Stir').length, 1);
// A drink made in parts: a group per part.
const parts = specLines([row('p', 'Milk', 100, 'ml', { part: 1 }), row('q', 'Rum', 50, 'ml', { part: 2 })]);
assert.deepEqual(specGroups(parts, 'Build').map((g) => g.title), ['Build', 'Part 2']);

assert.equal(methodVerb(['stir and strain']), 'Stir');
assert.equal(methodVerb([]), null);
assert.equal(serveLine(['Rocks', null, ' Large cube ', '', 'Candied ginger']), 'Rocks · Large cube · Candied ginger');
assert.equal(serveLine([null]), null);

console.log('specView: sticky view, Makes on jigger marks, grouped by step');
