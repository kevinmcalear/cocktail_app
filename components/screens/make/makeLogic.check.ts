import assert from 'node:assert/strict';

import { dayName, makeKit, missingKit, qrPath, splitHint, stepHave, weighHint } from './makeLogic';

// Kit: scale when weighed, tools from the step words, the container, then a label.
assert.deepEqual(
  makeKit([{ scaled: '500 g' }, { scaled: '250 ml' }], ['Warm the water in a pan.', 'Stir until dissolved, then bottle it.'], '750 ml bottle').map((k) => k.name),
  ['Scale', 'Small pan', 'Spatula', 'Funnel', '750 ml bottle', 'Label'],
);
assert.equal(makeKit([{ scaled: '500 g' }], [], null)[0].equipment, 'scale');
assert.deepEqual(makeKit([{ scaled: '30 ml' }], [], null).map((k) => k.name), ['Bottle or tub', 'Label']);
// Modernist kit by name, and a stick blender isn't also a blender.
assert.deepEqual(
  makeKit([{ scaled: '30 ml' }], ['Seal it in a vacuum bag and cook sous vide at 60°C.', 'Spin it in the Spinzall.', 'Blend with a stick blender.'], null)
    .filter((k) => k.equipment)
    .map((k) => k.equipment),
  ['stick-blender', 'sous-vide', 'chamber-vac', 'centrifuge'],
);
// What the kit doesn't list; a fine scale covers the scale.
const prepKit = makeKit([{ scaled: '500 g' }], ['Distil it in the rotovap.'], null);
assert.deepEqual(missingKit(prepKit, ['scale-fine']).map((k) => k.equipment), ['rotovap']);
assert.deepEqual(missingKit(prepKit, ['scale', 'rotovap']), []);

// Weigh-it hint only for water by volume.
assert.equal(weighHint({ name: 'Water', scaled: '332 ml' }), 'Or weigh it: 332 g');
assert.equal(weighHint({ name: 'Filtered water', scaled: '1.5 l' }), 'Or weigh it: 1.5 kg');
assert.equal(weighHint({ name: 'Sugar', scaled: '332 ml' }), null);
assert.equal(weighHint({ name: 'Water', scaled: '332 g' }), null);

// First sentence is the step; the rest is the hint.
assert.deepEqual(splitHint('Stir until clear. Do not let it boil.'), { main: 'Stir until clear.', hint: 'Do not let it boil.' });
assert.deepEqual(splitHint('Bottle it'), { main: 'Bottle it', hint: null });
assert.deepEqual(splitHint('Add 1.5 g salt.'), { main: 'Add 1.5 g salt.', hint: null });

// Stepper: 50s for big weights, 10s for middling, 1s for counts and small ones, never below one step.
assert.equal(stepHave(500, 'g', 1), 550);
assert.equal(stepHave(520, 'g', -1), 500);
assert.equal(stepHave(30, 'ml', 1), 40);
assert.equal(stepHave(3, null, 1), 4);
assert.equal(stepHave(1, null, -1), 1);

assert.equal(dayName(new Date(2026, 9, 9)), 'Friday');

// A 2 by 2 matrix with two dark modules, one module of quiet zone.
const q = qrPath([1, 0, 0, 1], 1);
assert.equal(q.size, 4);
assert.equal(q.d, 'M1 1h1v1h-1zM2 2h1v1h-1z');

console.log('makeLogic: ok');
