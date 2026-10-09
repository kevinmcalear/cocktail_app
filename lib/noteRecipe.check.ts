// Checks for lib/noteRecipe.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { readNoteRecipe } from './noteRecipe';

// Bar Bellamy's Pine Cordial, as its note is written.
const pine = readNoteRecipe(
  'Ingredients\n25 g Pine Needles\n500g Vodka\n100g Castor Sugar\n15ml Braulio Amaro\n\nMethod\nBruise the pine branches Heavily using the thermomix,  Add vodka and let infuse for 5mins. Strain through muslin cloth,  Add sugar and coffee filter, add Fernet Branca, store in the fridge.',
);
assert.ok(pine);
assert.deepEqual(pine.lines, [
  { amount: 25, unit: 'g', name: 'Pine Needles' },
  { amount: 500, unit: 'g', name: 'Vodka' },
  { amount: 100, unit: 'g', name: 'Castor Sugar' },
  { amount: 15, unit: 'ml', name: 'Braulio Amaro' },
]);
assert.equal(pine.steps.length, 2);
assert.match(pine.steps[0], /^Bruise the pine branches/);
assert.match(pine.steps[1], /^Strain through muslin cloth/);
assert.deepEqual(pine.check, { listed: 'Braulio Amaro', method: 'Fernet Branca' }, 'the method adds an amaro the list calls something else');

// Rows without headings: lines first, then the method; no question when it all matches.
const syrup = readNoteRecipe('1000 g sugar\n500 ml water\nStir over low heat until clear.\nCool and bottle.');
assert.ok(syrup);
assert.equal(syrup.lines.length, 2);
assert.deepEqual(syrup.steps, ['Stir over low heat until clear.', 'Cool and bottle.']);
assert.equal(syrup.check, null);

// A capitalised addition that is on the list raises nothing.
assert.equal(readNoteRecipe('Ingredients\n700 ml Campari\n300 g Sugar\nMethod\nAdd Campari to the sugar and stir.')?.check, null);

// Lines without amounts under the heading, and a percentage kept as a note.
const wash = readNoteRecipe('Ingredients\nGospel Rye Whisky\n30% Coconut Oil, by Weight\n\nMethod\n- Vac together\n- Cook sous vide at 60C for 90 minutes\n- Freeze overnight\n- Strain through oil filter');
assert.ok(wash);
assert.deepEqual(wash.lines, [
  { amount: null, unit: null, name: 'Gospel Rye Whisky' },
  { amount: null, unit: null, name: 'Coconut Oil', note: '30% by weight' },
]);
assert.deepEqual(wash.steps, ['Vac together', 'Cook sous vide at 60C for 90 minutes', 'Freeze overnight', 'Strain through oil filter']);

// A method on its own becomes steps; the import's leftovers don't.
const banana = readNoteRecipe('Method\n1. Put the thermomix on scale\n2. Add 1.5% of weight of ascorbic acid\n3. Centrifuge the puree, 4000rpm 20mins cycle\n\nMakes 0g.\n\nBy Will Bockman, 4th Dec 2024.');
assert.ok(banana);
assert.deepEqual(banana.lines, []);
assert.deepEqual(banana.steps, ['Put the thermomix on scale', 'Add 1.5% of weight of ascorbic acid', 'Centrifuge the puree, 4000rpm 20mins cycle']);
assert.equal(banana.check, null);
assert.equal(readNoteRecipe('Method\n1. No steps saved\n\nMakes 0g.\n\nBy Paul Lougrat, 16th Jul 2023.'), null, 'an empty import is nothing');

// Not a recipe.
assert.equal(readNoteRecipe('A bright, piney cordial for the Martini list.'), null);
assert.equal(readNoteRecipe('500 ml gin'), null, 'one line is not enough');
assert.equal(readNoteRecipe(null), null);

console.log('noteRecipe checks passed');
