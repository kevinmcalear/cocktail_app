// Checks for lib/dietary.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { animalLines, dietaryLine } from './dietary';

// The board's Penicillin: honey makes it not vegan.
assert.equal(dietaryLine(['Blended Scotch', 'Lemon juice', 'Honey-ginger syrup', 'Islay Scotch']), 'Contains honey-ginger syrup, so not vegan.');

// Plant milks and creams, butterfly pea and honeydew are not animal.
assert.deepEqual(animalLines(['Oat milk', 'Coconut cream', 'Cream of coconut', 'Butterfly pea tea', 'Honeydew melon', 'Cocoa butter']), []);
// Egg whites, cream and milk are; a named vegan foam isn't.
assert.deepEqual(animalLines(['Egg white', 'Heavy cream', 'Whole milk', 'Vegan foam', 'Aquafaba']), ['Egg white', 'Heavy cream', 'Whole milk']);
assert.equal(dietaryLine(['Gin', 'Egg white', 'Heavy cream', 'Honey syrup', 'Lemon']), 'Contains egg white, heavy cream and honey syrup, so not vegan.');

// Nothing named, but the venue declared eggs on something it buys.
assert.equal(dietaryLine(['Gin', 'Foamer'], ['eggs', 'sulphites']), 'Contains eggs, so not vegan.');
assert.equal(dietaryLine(['Gin', 'Campari', 'Sweet vermouth']), 'Nothing from animals in the spec, so vegan.');

// Names hidden from this role: nothing to say.
assert.equal(dietaryLine([null, null]), null);
