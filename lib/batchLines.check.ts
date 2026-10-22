// Checks for lib/batchLines.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { batchOf, batchSummary, bottleMl, cannotBatch, drinksPerBottle, dropInto, splitBatch, withBottle } from './batchLines';
import { perDrink, sketchLook, EMPTY_DRAFT, type WizardLine } from './drinkWizard';
import { prepAmounts, prepYield } from './prepKinds';

const line = (key: string, name: string, amount: string, unit = 'ml'): WizardLine => ({ key, id: `id-${key}`, name, amount, unit });
const mezcal = line('m', 'Mezcal', '45');
const agave = line('a', 'Agave syrup', '15');
const lime = line('l', 'Lime juice', '22.5');

// Agave dropped on mezcal: one line where mezcal sat, named after the drink, 60 ml.
const one = dropInto([mezcal, agave, lime], 'a', 'm', 'Ash Garden');
assert.equal(one.length, 2);
const batch = one[0];
assert.equal(batch.name, 'Ash Garden batch');
assert.equal(batch.amount, '60');
assert.equal(batch.unit, 'ml');
assert.equal(batch.id, null);
assert.equal(one[1], lime);
assert.equal(batchSummary(batch.prep!), 'Batch · mezcal, agave syrup');

// Inside, one 750 ml bottle split by the drink's ratio, about 12 drinks.
assert.deepEqual(prepAmounts(batch.prep!).map((p) => p.amount), [562.5, 187.5]);
assert.equal(prepYield(batch.prep!), 750);
assert.equal(bottleMl(batch.prep!), 750);
assert.equal(drinksPerBottle(batch.prep!, batch), 12);
assert.deepEqual(prepAmounts(withBottle(batch.prep!, 1000)).map((p) => p.amount), [750, 250]);
assert.equal(bottleMl(withBottle(batch.prep!, 700)), 700);

// Per drink, only if asked: the share of the line's pour. The drawing uses them.
assert.deepEqual(perDrink(one).map((l) => [l.name, l.amount]), [['Mezcal', '45'], ['Agave syrup', '15'], ['Lime juice', '22.5']]);
assert.deepEqual(sketchLook({ ...EMPTY_DRAFT, lines: one }).lines.map((l) => l.name), ['Mezcal', 'Agave syrup', 'Lime juice']);
// A bigger pour of the batch is more of each.
assert.deepEqual(perDrink([{ ...batch, amount: '90' }]).map((l) => l.amount), ['67.5', '22.5']);

// Lime dropped on the batch goes in the bottle; the batch keeps its name, key and bottle.
const more = dropInto(one, 'l', batch.key, 'Ash Garden');
assert.equal(more.length, 1);
assert.equal(more[0].key, batch.key);
assert.equal(more[0].amount, '82.5');
assert.equal(bottleMl(more[0].prep!), 750);
assert.deepEqual(perDrink(more).map((l) => l.amount), ['45', '15', '22.5']);
// The batch dragged onto a line works the same way.
assert.equal(dropInto(one, batch.key, 'l', 'Ash Garden')[0].key, batch.key);

// Split back: the lines as they were, in their place.
assert.deepEqual(splitBatch(one, batch.key).map((l) => [l.key, l.id, l.name, l.amount, l.unit]), [
  ['m', 'id-m', 'Mezcal', '45', 'ml'],
  ['a', 'id-a', 'Agave syrup', '15', 'ml'],
  ['l', 'id-l', 'Lime juice', '22.5', 'ml'],
]);

// Ounces stay ounces in the drink; the bottle is in ml.
const oz = batchOf([line('m', 'Mezcal', '1.5', 'oz'), line('a', 'Agave syrup', '0.5', 'oz')], 'Ash Garden');
assert.equal(oz.unit, 'oz');
assert.equal(oz.amount, '2');
assert.deepEqual(prepAmounts(oz.prep!).map((p) => p.amount), [562.5, 187.5]);
assert.deepEqual(perDrink([oz]).map((l) => l.amount), ['1.5', '0.5']);

// Dashes go in; a top or a line with no amount can't.
assert.equal(cannotBatch(line('b', 'Angostura bitters', '2', 'dash')), null);
assert.match(cannotBatch(line('s', 'Soda', '', 'top')) ?? '', /top/);
assert.match(cannotBatch(line('x', 'Mezcal', '')) ?? '', /amount/);
// No name yet: a house batch.
assert.equal(batchOf([mezcal, agave], '  ').name, 'House batch');

// An ounce is the bar's 30 ml both ways: 2 oz and 2 oz is 4 oz, and splits back to 2 and 2.
const four = batchOf([line('g', 'Gin', '2', 'oz'), line('v', 'Dry vermouth', '2', 'oz')], 'Martini');
assert.equal(four.amount, '4');
assert.deepEqual(perDrink([four]).map((l) => [l.amount, l.unit]), [['2', 'oz'], ['2', 'oz']]);
// Dashes and grams come back as they were poured.
const bitters = dropInto([mezcal, line('b', 'Angostura bitters', '2', 'dash')], 'b', 'm', 'Ash Garden');
assert.deepEqual(splitBatch(bitters, bitters[0].key).map((l) => [l.name, l.amount, l.unit]), [['Mezcal', '45', 'ml'], ['Angostura bitters', '2', 'dash']]);
// A second batch in the drink gets its own name.
const two = dropInto([...one, line('s', 'Soda', '30'), line('t', 'Tonic', '30')], 's', 't', 'Ash Garden');
assert.deepEqual(two.map((l) => l.name), ['Ash Garden batch', 'Lime juice', 'Ash Garden batch 2']);
// A new house prep keeps its recipe: it isn't batched until it's saved. A batch with no pour can't take more.
assert.match(cannotBatch({ ...line('p', 'Pineapple shrub', '15'), id: null, later: true }) ?? '', /house prep/);
assert.match(cannotBatch({ ...batch, amount: '' }) ?? '', /amount/);
