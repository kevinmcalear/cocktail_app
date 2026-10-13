import assert from 'node:assert/strict';

import { GLASS_SHAPES } from './geometry';
import { glassOutline } from './glassOutline';

// A coupe: the bowl, the rim across it, a stem and a foot.
const coupe = glassOutline(GLASS_SHAPES.coupe);
assert.equal(coupe.split('M ').length - 1, 4, 'bowl, rim, stem, foot');
assert.ok(coupe.startsWith('M 23.5 31 L'), 'the bowl starts at the left of the rim');
assert.ok(coupe.includes('M 50 51.3 L 50 86'), 'the stem runs from the bowl to the foot');

// A rocks glass has no stem: a body closed across its base, and the rim.
const rocks = glassOutline(GLASS_SHAPES.rocks);
assert.equal(rocks.split('M ').length - 1, 2);
assert.ok(rocks.includes('L 72.5 86'), 'the body is closed across the bottom');

// Every glass draws inside its 100 by 100 box.
for (const [name, shape] of Object.entries(GLASS_SHAPES)) {
  for (const v of glassOutline(shape).match(/-?\d+(\.\d+)?/g) ?? []) assert.ok(+v >= 0 && +v <= 100, `${name}: ${v} is in the box`);
}
