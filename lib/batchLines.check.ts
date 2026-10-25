// Checks for lib/batchLines.ts: the bottle maths of a batch made by dropping lines together. Run: npm run test:unit
import assert from 'node:assert/strict';

import { batchCaption, batchPrep, bottleAmounts, drinkMl, drinksPerBottle, mergeLines, perDrinkLines, pourMl, splitBatch, withBatch, withBottleAmount } from './batchLines';
import type { WizardLine } from './drinkWizard';
import { prepAmounts, prepYield } from './prepKinds';

const l = (key: string, name: string, amount: string, unit = 'ml', id: string | null = `id-${key}`): WizardLine => ({ key, id, name, amount, unit });
const mezcal = l('m', 'Mezcal', '45');
const agave = l('a', 'Agave syrup', '15');
const lime = l('j', 'Lime juice', '22.5');
const spec = [mezcal, agave, lime];

// Pours read in ml; counts and tops don't.
assert.equal(pourMl(l('x', 'Gin', '0.75', 'oz')), 22.5);
assert.equal(pourMl(l('x', 'Gin', '2', 'cl')), 20);
assert.equal(pourMl(l('x', 'Bitters', '2', 'dash')), null);
assert.equal(pourMl(l('x', 'Soda', '', 'top')), null);

// The board: agave syrup dropped on mezcal makes "Ash Garden batch", 60 ml, where mezcal was.
const merged = mergeLines(spec, 1, 0, 'Ash Garden')!;
assert.deepEqual(merged.map((x) => x.name), ['Ash Garden batch', 'Lime juice']);
const batch = merged[0];
assert.equal(batch.key, 'm', 'it keeps the line it was dropped on');
assert.deepEqual({ amount: batch.amount, unit: batch.unit, id: batch.id }, { amount: '60', unit: 'ml', id: null });
assert.deepEqual(batch.batch!.lines.map((x) => x.name), ['Mezcal', 'Agave syrup'], 'in the spec order');
assert.equal(batch.batch!.bottleMl, 750);
assert.equal(batchCaption(batch.batch!), 'Batch · mezcal, agave syrup');

// One 750 ml bottle: 562.5 ml mezcal and 187.5 ml agave, about 12 drinks.
assert.deepEqual(bottleAmounts(batch.batch!).map((b) => [b.line.name, b.amount, b.unit]), [['Mezcal', 562.5, 'ml'], ['Agave syrup', 187.5, 'ml']]);
assert.equal(drinksPerBottle(750, drinkMl(batch.batch!.lines)), 12);
assert.equal(drinksPerBottle(1000, 60), 16);
assert.equal(drinksPerBottle(720, 60), 12, 'an exact fit is a whole drink');
assert.equal(drinksPerBottle(750, 0), 0);
// 700 ml and 1 L follow.
assert.deepEqual(bottleAmounts({ ...batch.batch!, bottleMl: 700 }).map((b) => b.amount), [525, 175]);
assert.deepEqual(bottleAmounts({ ...batch.batch!, bottleMl: 1000 }).map((b) => b.amount), [750, 250]);

// Counts go by the drinks the bottle makes: 2 dashes a drink, 25 for 12 and a half.
const dashes = bottleAmounts({ lines: [mezcal, agave, l('b', 'Mole bitters', '2', 'dash')], bottleMl: 750 });
assert.deepEqual(dashes.map((b) => [b.amount, b.unit]), [[562.5, 'ml'], [187.5, 'ml'], [25, 'dash']]);

// Ounces: the batch line stays in ounces, the bottle in ml.
const oz = mergeLines([l('r', 'Rye', '2', 'oz'), l('v', 'Sweet vermouth', '1', 'oz')], 0, 1, 'Manhattan')!;
assert.deepEqual({ amount: oz[0].amount, unit: oz[0].unit }, { amount: '3', unit: 'oz' });
assert.deepEqual(bottleAmounts(oz[0].batch!).map((b) => b.amount), [500, 250]);

// Lime juice dropped on the batch goes in the bottle; the batch keeps its name and bottle.
const renamed = [{ ...withBatch(batch, { ...batch.batch!, bottleMl: 1000 }), name: 'House agave' }, lime];
const added = mergeLines(renamed, 1, 0, 'Ash Garden')!;
assert.equal(added.length, 1);
assert.deepEqual({ name: added[0].name, amount: added[0].amount, bottle: added[0].batch!.bottleMl }, { name: 'House agave', amount: '82.5', bottle: 1000 });
// A batch dropped on a line takes it in too, where the line was.
assert.deepEqual(mergeLines([lime, batch], 1, 0, 'Ash Garden')!.map((x) => x.batch?.lines.length), [3]);

// What can't batch: two batches, a house prep still to make, nothing measured.
assert.equal(mergeLines([batch, { ...batch, key: 'z' }], 0, 1, 'X'), null);
assert.equal(mergeLines([mezcal, { ...agave, id: null, later: true }], 1, 0, 'X'), null);
assert.equal(mergeLines([l('b', 'Bitters', '2', 'dash'), l('s', 'Soda', '', 'top')], 1, 0, 'X'), null);
assert.equal(mergeLines(spec, 0, 0, 'X'), null);

// The drawing, the cost and the taste use one drink's own lines.
assert.deepEqual(perDrinkLines(merged).map((x) => [x.name, x.amount]), [['Mezcal', '45'], ['Agave syrup', '15'], ['Lime juice', '22.5']]);
// Split back into lines: as they were, where the batch was.
assert.deepEqual(splitBatch(merged, 'm'), spec.map((x) => x), 'split gives the lines back unchanged');
assert.deepEqual(splitBatch(merged, 'nope'), merged);

// Saved as a Batch prep: the bottle's recipe, its yield the bottle exactly.
const prep = batchPrep(batch.batch!);
assert.equal(prep.kind, 'batch');
assert.deepEqual(prep.actions, ['Batch']);
assert.deepEqual(prepAmounts(prep).map((a) => a.amount), [562.5, 187.5]);
assert.equal(prepYield(prep), 750);
assert.equal(prepYield(batchPrep({ lines: [l('g', 'Gin', '50'), l('c', 'Campari', '25'), l('v', 'Vermouth', '25')], bottleMl: 333 })), 333, 'an odd bottle is not rounded to 10');
const withDash = batchPrep({ lines: [mezcal, agave, l('b', 'Mole bitters', '2', 'dash')], bottleMl: 750 });
assert.deepEqual(prepAmounts(withDash).map((a) => [a.amount, a.line.unit]), [[562.5, 'ml'], [187.5, 'ml'], [25, 'dash']]);
assert.equal(prepYield(withDash), 750, 'dashes count no volume');

console.log('batchLines checks passed');

// Kevin's miso banana liqueur (24 Oct): red miso to taste dropped on 22.5 ml Tempus Fugit, then 70 g of miso typed in the bottle.
{
  const miso = mergeLines([l('t', 'Tempus Fugit Crème de Banane', '22.5'), l('r', 'Red miso', '', 'g')], 1, 0, 'Salty Boy')![0].batch!;
  assert.deepEqual(bottleAmounts(miso).map((x) => x.amount), [750, null], 'miso starts to taste');
  const typed = withBottleAmount(miso, 'r', 70, 'g');
  assert.deepEqual(bottleAmounts(typed).map((x) => [x.amount, x.unit]), [[750, 'ml'], [70, 'g']]);
  assert.equal(typed.lines[1].amount, '2.1', 'one drink has 2.1 g of it');
  assert.equal(drinkMl(typed.lines), 22.5, 'the drink still takes 22.5 ml');
  assert.equal(withBottleAmount(typed, 'r', null, 'g').lines[1].amount, '', 'cleared is to taste again');
  // Typed as ml instead, it's poured: an 820 ml bottle, the liqueur still 750 of it, a drink still 22.5 ml.
  const poured = withBottleAmount(miso, 'r', 70, 'ml');
  assert.equal(poured.bottleMl, 820);
  assert.deepEqual(bottleAmounts(poured).map((x) => [x.amount, x.unit]), [[750, 'ml'], [70, 'ml']]);
  assert.equal(drinkMl(poured.lines), 22.5);
  assert.equal(withBottleAmount(miso, 'zz', 70, 'g'), miso);

  // 700 ml of the liqueur instead: the bottle is 700, the miso stays 70 g, a drink still takes 22.5 ml.
  const smaller = withBottleAmount(typed, 't', 700, 'ml');
  assert.equal(smaller.bottleMl, 700);
  assert.deepEqual(bottleAmounts(smaller).map((x) => x.amount), [700, 70]);
  assert.equal(drinkMl(smaller.lines), 22.5);
  assert.equal(withBottleAmount(typed, 't', 0, 'ml'), typed, 'nothing left poured');
  // The liqueur weighed instead: nothing poured either.
  assert.equal(withBottleAmount(typed, 't', 700, 'g'), typed);
}

// Two pours: 600 ml mezcal with the agave left at 187.5 is an 787.5 ml bottle; one drink is still 60 ml, in the ratio typed.
{
  const more = withBottleAmount(batch.batch!, 'm', 600, 'ml');
  assert.equal(more.bottleMl, 787.5);
  assert.deepEqual(bottleAmounts(more).map((x) => x.amount), [600, 187.5]);
  assert.equal(drinkMl(more.lines), 60);
  // Ounces stay ounces.
  const oz = withBottleAmount({ lines: [l('g', 'Gin', '1.5', 'oz'), l('v', 'Vermouth', '1.5', 'oz')], bottleMl: 750 }, 'g', 375, 'ml');
  assert.deepEqual(oz.lines.map((x) => [x.amount, x.unit]), [['1.5', 'oz'], ['1.5', 'oz']]);
}
