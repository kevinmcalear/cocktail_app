// Checks for lib/dietary.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { animalLines, dietaryLine, veganWord, withVegan } from './dietary';

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

// The floor's line: vegan by the word in the spec (board Decided-who-floor).
assert.equal(veganWord(['Blended Scotch', 'Lemon juice', 'Honey-ginger syrup', 'Islay Scotch']), 'not vegan (honey)');
assert.equal(veganWord(['Gin', 'Egg white', 'Heavy cream', 'Honey syrup', 'Lemon']), 'not vegan (egg, cream and honey)');
assert.equal(veganWord(['Gin', 'Foamer'], ['eggs']), 'not vegan (eggs)');
assert.equal(veganWord(['Gin', 'Campari', 'Sweet vermouth']), 'vegan');
assert.equal(veganWord([null]), null);
assert.equal(veganWord(['Gin', 'Campari'], [], false), null, 'ingredients not checked: never a guessed "vegan"');
assert.equal(veganWord(['Gin', null]), null, 'a name hidden: never a guessed "vegan"');
assert.equal(veganWord(['Gin', 'Honey syrup'], [], false), 'not vegan (honey)', 'what the spec says still reads');
assert.equal(withVegan('No allergens.', 'not vegan (honey)'), 'No allergens · not vegan (honey)');
assert.equal(withVegan('Contains sulphites. 1 ingredient not checked yet.', 'vegan'), 'Contains sulphites · vegan. 1 ingredient not checked yet.');
assert.equal(withVegan('No allergens.', null), 'No allergens.', 'names hidden: the line as it was');

console.log('dietary: vegan from the spec, in the floor line');
