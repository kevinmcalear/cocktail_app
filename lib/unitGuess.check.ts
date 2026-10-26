import assert from 'node:assert/strict';

import { MEASURE_UNITS } from './prepKinds';
import { guessUnit, isLooseSalt, prepUnit, typedUnit } from './unitGuess';
import { RECIPE_UNITS } from './units';

// Dry things are weighed, in a drink and in a house recipe alike (Q18, Q19).
for (const name of ['Sugar', 'Demerara sugar', 'Caster Sugar', 'Sea salt', 'Kosher Salt', 'Citric acid', 'Malic Acid', 'MSG', 'Matcha powder', 'Cocoa powder', 'Xanthan gum', 'Agar', 'Gelatine', 'Cream of tartar']) {
  assert.equal(guessUnit(name, 'oz'), 'g', `${name} is weighed`);
  assert.equal(prepUnit(name), 'g', `${name} is weighed in a recipe`);
}
// A dry word in something poured is poured.
for (const name of ['Simple syrup', 'Demerara Sugar Syrup', 'Salt solution', 'Saline', 'Cocoa liqueur', 'Sugar water', 'Citric acid solution', 'Coconut cream', 'Honey']) {
  assert.notEqual(guessUnit(name, 'ml'), 'g', `${name} is poured`);
}
assert.equal(guessUnit('Sugar cube', 'ml'), 'each');

// Bitters dashed, saline and tinctures dropped, eggs counted, soda topped.
assert.equal(guessUnit('Angostura Bitters', 'ml'), 'dash');
assert.equal(guessUnit('Saline Solution (20%)', 'ml'), 'drop');
assert.equal(guessUnit('Smoked chili tincture', 'oz'), 'drop');
assert.equal(guessUnit('Egg white', 'ml'), 'each');
assert.equal(guessUnit('Whole egg', 'oz'), 'each');
assert.equal(guessUnit('Soda water', 'oz'), 'top');
assert.equal(guessUnit('Fever-Tree Tonic', 'ml'), 'top');
assert.equal(guessUnit('Ginger beer syrup', 'oz'), 'oz');

// Everything else in your usual: ml, oz, cl.
assert.equal(guessUnit('Gin', 'oz'), 'oz');
assert.equal(guessUnit('Lime juice', 'ml'), 'ml');
assert.equal(guessUnit('Sweet vermouth', 'cl'), 'cl');

// A typed number means it isn't a top; a typed unit wins.
assert.equal(typedUnit('Soda water', null, 'ml'), 'ml');
assert.equal(typedUnit('Sugar', null, 'ml'), 'g');
assert.equal(typedUnit('Sugar', 'tsp', 'ml'), 'tsp');

// A house recipe pours in ml and never tops; every guess is a unit its picker offers.
assert.equal(prepUnit('Water'), 'ml');
assert.equal(prepUnit('Soda water'), 'ml');
assert.equal(prepUnit('Lime juice'), 'ml');
assert.equal(prepUnit('Peychaud’s Bitters'), 'dash');
for (const name of ['Water', 'Sugar', 'Soda', 'Bitters', 'Saline', 'Egg white', 'Gin']) {
  assert.ok((MEASURE_UNITS as readonly string[]).includes(prepUnit(name)), `${name}: ${prepUnit(name)} is in the recipe's unit picker`);
}
for (const name of ['Sugar', 'Soda', 'Bitters', 'Saline', 'Egg', 'Sugar cube']) {
  assert.ok(RECIPE_UNITS.some((u) => u.value === guessUnit(name, 'ml')), `${name}: a recipe unit`);
}

// Loose salt gets the saline hint; saline, salted syrups and a salt rim don't.
for (const name of ['Salt', 'Sea salt', 'Maldon sea salt flakes', 'Kosher salt']) assert.ok(isLooseSalt(name), name);
for (const name of ['Saline', 'Salt solution', 'Salted caramel syrup', 'Salt rim', 'Celery salt', 'Smoked salt', 'Chili lime salt', 'Sugar']) assert.ok(!isLooseSalt(name), name);

console.log('unitGuess.check.ts: ok');
