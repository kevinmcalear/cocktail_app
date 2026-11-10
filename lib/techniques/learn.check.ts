import assert from 'node:assert/strict';

import './testing';
import { GROUPS } from './index';
import { EQUIPMENT, TECHNIQUES } from './library';
import { kitPicks, pairLine, pickOfDay, stepParts } from './learn';

// Steps as Kept-learn draws them: the first sentence is the name.
assert.deepEqual(stepParts('Pour off the clear liquid. Expect 80 to 95% back.'), { name: 'Pour off the clear liquid', rest: 'Expect 80 to 95% back.' });
assert.deepEqual(stepParts('Freeze it solid.'), { name: 'Freeze it solid', rest: '' });
assert.deepEqual(stepParts('Spin at about 4,000 g.'), { name: 'Spin at about 4,000 g', rest: '' });
assert.deepEqual(stepParts('Add 0.5 g agar. Whisk.'), { name: 'Add 0.5 g agar', rest: 'Whisk.' }, 'a decimal point is not a sentence end');

// Nothing said yet: the two pieces that open the most, neither on the shelf.
const none = kitPicks(new Set());
assert.equal(none.length, 2);
assert.ok(none.every((p) => !p.have && p.opens > 0));
assert.ok(none[0].opens >= none[1].opens);

// With a shelf: what you have first, then what would open the most.
const shelf = new Set([EQUIPMENT[0].id, EQUIPMENT[1].id]);
const picks = kitPicks(shelf);
assert.equal(picks.length, 2);
assert.ok(picks[0].have && shelf.has(picks[0].id));
assert.ok(!picks[1].have && !shelf.has(picks[1].id) && picks[1].opens > 0);

assert.equal(pairLine('Campari', 'Grapefruit', 38), 'Campari goes with Grapefruit in 38 drinks.');
assert.equal(pairLine('Gin', 'Lime', 1), 'Gin goes with Lime in 1 drink.');

assert.equal(pickOfDay([], new Date(2026, 10, 1)), undefined);
assert.equal(pickOfDay(['a', 'b'], new Date(2026, 10, 1, 1)), pickOfDay(['a', 'b'], new Date(2026, 10, 1, 23)), 'the same all day');
assert.notEqual(pickOfDay(['a', 'b'], new Date(2026, 10, 1)), pickOfDay(['a', 'b'], new Date(2026, 10, 2)), 'and the next day the next');

// The hub's first group is the one the board draws: Shake and stir, with something in it.
assert.equal(GROUPS[0].name, 'Shake and stir');
assert.ok(TECHNIQUES.some((t) => t.group === 'shake'));
