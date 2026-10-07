import assert from 'node:assert/strict';

import { draftSketchInputs } from './draft';
import { readSketchInputs } from './types';

// A drink with only a name still draws: a default glass and colour.
const bare = draftSketchInputs({ name: 'Untitled', lines: [] });
assert.ok(readSketchInputs(bare), 'a bare draft is drawable');
assert.equal(bare.from.liquid, 'default');

// Each step changes the drawing the way the saved drink will.
const negroni = {
  name: 'House Negroni',
  lines: [
    { name: 'Gin', amount: 30, unit: 'ml' },
    { name: 'Campari', amount: 30, unit: 'ml' },
    { name: 'Sweet vermouth', amount: 30, unit: 'ml' },
  ],
};
const spec = draftSketchInputs(negroni);
assert.equal(spec.glass, 'rocks', 'the name hints a rocks glass');
assert.equal(spec.method, 'stir');
assert.equal(spec.garnish, 'orange_peel', 'Negroni hints an orange peel');
const [r, g] = [1, 3].map((i) => parseInt(spec.liquid.hex.slice(i, i + 2), 16));
assert.ok(r > g * 1.5, `Campari makes it red, got ${spec.liquid.hex}`);

const picked = draftSketchInputs({ ...negroni, glass: 'Coupe', ice: 'None', methods: ['Shake'] });
assert.equal(picked.glass, 'coupe', 'a picked glass wins over the name');
assert.equal(picked.ice, 'none');
assert.equal(picked.method, 'shake');
assert.equal(picked.from.glass, 'data');

// A garnish line (a count unit) draws as the garnish, not as liquid.
const garnished = draftSketchInputs({ name: 'Sour', lines: [...negroni.lines, { name: 'Lime', amount: 1, unit: 'wheel' }] });
assert.equal(garnished.garnish, 'lime_wheel');
assert.equal(garnished.liquid.hex, spec.liquid.hex, 'a garnish adds no colour');

const dusted = draftSketchInputs({ name: 'Flip', lines: [{ name: 'Nutmeg', amount: 1, unit: 'pinch' }] });
assert.equal(dusted.garnish, 'grated_spice', 'a pinch on top is a garnish');

console.log('draft sketch: ok');
