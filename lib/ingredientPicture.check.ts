// Checks for lib/ingredientPicture.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { canChoosePicture, ingredientHeroPictures, shownIngredientPicture } from './ingredientPicture';

const url = 'http://127.0.0.1:54321/storage/v1/object/public/drinks/ingredients/a/1.jpg';
assert.deepEqual(shownIngredientPicture('photo', url), { kind: 'photo', url });
assert.deepEqual(shownIngredientPicture('photo', null), { kind: 'drawing' }, 'Your photo with its photo gone is drawn');
assert.deepEqual(shownIngredientPicture('none', url), { kind: 'none' });
assert.deepEqual(shownIngredientPicture(undefined, undefined), { kind: 'drawing' }, 'an old cached row is drawn');

const batch = [{ url: 'drink.jpg', isSketch: false, isOutdated: false, credit: null, sourceUrl: null }];
assert.equal(ingredientHeroPictures({ kind: 'none' }, batch), null, 'None: no hero, even for a batch');
assert.deepEqual(ingredientHeroPictures({ kind: 'drawing' }, batch), batch, "a drawn batch keeps the drink's photos");
assert.deepEqual(ingredientHeroPictures({ kind: 'drawing' }, []), []);
assert.deepEqual(ingredientHeroPictures({ kind: 'photo', url }, batch)!.map((p) => p.url), [url], 'its own photo replaces them');

assert.equal(canChoosePicture({ bar_id: 'bar', created_by: null }), true, "a bar's own ingredient");
assert.equal(canChoosePicture({ bar_id: null, created_by: 'me' }), true, "a person's own ingredient");
assert.equal(canChoosePicture({ bar_id: null, created_by: null }), false, 'a catalogue bottle stays drawn');
assert.equal(canChoosePicture({ bar_id: 'bar', item_type: 'cocktail' }), false);
assert.equal(canChoosePicture(null), false);

console.log('ingredientPicture checks passed');
