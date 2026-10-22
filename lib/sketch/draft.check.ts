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


// A stored row draws the venue's ice over a guessed one (set by the database).
const stored = readSketchInputs({ ...bare, ice: 'cubes', houseIce: 'large' });
assert.equal(stored?.ice, 'large');
assert.equal(readSketchInputs({ ...bare, ice: 'cubes', houseIce: 'none' })?.ice, 'cubes', 'never no ice');
assert.equal(readSketchInputs({ ...bare, ice: 'cubes', houseIce: 'gravel' })?.ice, 'cubes', 'an unknown kind is ignored');

console.log('draft sketch: ok');

// A discard finishes the drink with nothing on the glass: the name's guess
// (a Spritz's orange wheel) doesn't draw over it, but a plain Spritz keeps it.
const spritzLines = [
  { name: 'Fino sherry', amount: 30, unit: 'ml' },
  { name: 'Soda water', amount: null, unit: 'top' },
];
const spritz = { name: 'Fig Leaf Spritz', glass: 'Spritz glass', methods: ['Build'], ice: 'Cubes', lines: spritzLines };
assert.equal(draftSketchInputs(spritz).garnish, 'orange_wheel', 'a plain Spritz gets its guessed wheel');
const discard = draftSketchInputs({ ...spritz, lines: [...spritzLines, { name: 'Lemon', amount: 1, unit: 'discard' }] });
assert.equal(discard.garnish, null, 'a discard draws no garnish');
assert.equal(discard.from.garnish, 'default');
const both = draftSketchInputs({ ...spritz, lines: [...spritzLines, { name: 'Lemon', amount: 1, unit: 'discard' }, { name: 'Olive', amount: 1, unit: 'each' }] });
assert.equal(both.garnish, 'olive', 'a real garnish line still draws beside a discard');
