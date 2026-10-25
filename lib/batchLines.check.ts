// Checks for lib/batchLines.ts: two lines combined into a house prep, and the bottle maths of a batch. Run: npm run test:unit
import assert from 'node:assert/strict';

import { batchLine, batchPrep, bottleAmounts, combineLines, drinkMl, drinksPerBottle, linePrep, perDrinkLines, pourMl, uncombine } from './batchLines';
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

// Agave syrup dropped on mezcal: one line, "Ash Garden batch", 60 ml, where mezcal was, its recipe a Batch.
const merged = combineLines(spec, 1, 0, 'Ash Garden')!;
assert.deepEqual(merged.map((x) => x.name), ['Ash Garden batch', 'Lime juice']);
const batch = merged[0];
assert.equal(batch.key, 'm', 'it keeps the line it was dropped on');
assert.deepEqual({ amount: batch.amount, unit: batch.unit, id: batch.id }, { amount: '60', unit: 'ml', id: null });
assert.equal(batch.batch, undefined, 'a house prep line, not a batch read from a file');
assert.equal(batch.prep!.kind, 'batch');
assert.deepEqual(batch.prep!.lines.map((x) => x.name), ['Mezcal', 'Agave syrup'], 'in the spec order');
// One 750 ml bottle: 562.5 ml mezcal and 187.5 ml agave, about 12 drinks.
assert.deepEqual(prepAmounts(batch.prep!).map((a) => a.amount), [562.5, 187.5]);
assert.equal(prepYield(batch.prep!), 750);
assert.equal(drinksPerBottle(750, drinkMl(batch.combined!)), 12);
assert.equal(drinksPerBottle(720, 60), 12, 'an exact fit is a whole drink');
assert.equal(drinksPerBottle(750, 0), 0);

// Backing out puts the lines back as they were, where the batch was.
assert.deepEqual(uncombine(merged, 'm'), spec);
assert.deepEqual(uncombine(merged, 'nope'), merged);
// Once its recipe is done (combined cleared), there's nothing to put back.
assert.deepEqual(uncombine([{ ...batch, combined: undefined }, lime], 'm').length, 2);

// Ounces: the line stays in ounces, the bottle in ml.
const oz = combineLines([l('r', 'Rye', '2', 'oz'), l('v', 'Sweet vermouth', '1', 'oz')], 0, 1, 'Manhattan')!;
assert.deepEqual({ amount: oz[0].amount, unit: oz[0].unit }, { amount: '3', unit: 'oz' });
assert.deepEqual(prepAmounts(oz[0].prep!).map((a) => a.amount), [500, 250]);

// What can't combine: a house prep already, one still to write, nothing measured, the same line.
assert.equal(combineLines([batch, lime], 1, 0, 'X'), null);
assert.equal(combineLines([mezcal, { ...agave, id: null, later: true }], 1, 0, 'X'), null);
assert.equal(combineLines([l('b', 'Bitters', '2', 'dash'), l('s', 'Soda', '', 'top')], 1, 0, 'X'), null);
assert.equal(combineLines(spec, 0, 0, 'X'), null);

// The drawing, the cost and the taste use one drink's own lines: a batch's share of the bottle, any other prep as one line.
assert.deepEqual(perDrinkLines(merged).map((x) => [x.name, x.amount]), [['Mezcal', '45'], ['Agave syrup', '15'], ['Lime juice', '22.5']]);
const infusion = { ...batch, prep: { ...batch.prep!, kind: 'infusion' as const } };
assert.deepEqual(perDrinkLines([infusion]).map((x) => x.name), ['Ash Garden batch']);

// Counts go by the drinks the bottle makes: 2 dashes a drink, 25 for 12 and a half.
const dashes = bottleAmounts({ lines: [mezcal, agave, l('b', 'Mole bitters', '2', 'dash')], bottleMl: 750 });
assert.deepEqual(dashes.map((b) => [b.amount, b.unit]), [[562.5, 'ml'], [187.5, 'ml'], [25, 'dash']]);
const withDash = batchPrep({ lines: [mezcal, agave, l('b', 'Mole bitters', '2', 'dash')], bottleMl: 750 });
assert.deepEqual(prepAmounts(withDash).map((a) => [a.amount, a.line.unit]), [[562.5, 'ml'], [187.5, 'ml'], [25, 'dash']]);
assert.equal(prepYield(withDash), 750, 'dashes count no volume');
assert.equal(prepYield(batchPrep({ lines: [l('g', 'Gin', '50'), l('c', 'Campari', '25'), l('v', 'Vermouth', '25')], bottleMl: 333 })), 333, 'an odd bottle is not rounded to 10');

// A batch read from a file is saved, and opened, as the house prep it is.
const read = batchLine('b', 'Smoke Signal batch', [mezcal, agave], 1000);
assert.equal(linePrep(read)!.kind, 'batch');
assert.deepEqual(prepAmounts(linePrep(read)!).map((a) => a.amount), [750, 250]);
assert.equal(linePrep({ prep: batch.prep }), batch.prep, 'its own recipe first');
assert.equal(linePrep({}), undefined);

// Kevin's miso banana liqueur (24 Oct): red miso to taste dropped on 22.5 ml Tempus Fugit, then 70 g of miso as it goes in.
{
  const [line] = combineLines([l('t', 'Tempus Fugit Crème de Banane', '22.5'), l('r', 'Red miso', '', 'g')], 1, 0, 'Salty Boy')!;
  assert.equal(line.name, 'Salty Boy batch');
  assert.deepEqual(prepAmounts(line.prep!).map((x) => x.amount), [750, null], 'the liqueur fills the bottle, the miso starts to taste');
  const typed = { ...line.prep!, kind: 'batch' as const, lines: line.prep!.lines.map((x) => (x.key === 'r' ? { ...x, amount: '70' } : x)) };
  assert.deepEqual(prepAmounts(typed).map((x) => [x.amount, x.line.unit]), [[750, 'ml'], [70, 'g']]);
  assert.equal(prepYield(typed), 750, 'miso by weight adds no volume');
  // One drink still takes 22.5 ml of it: 22.5 ml of the liqueur and 2.1 g of miso.
  assert.deepEqual(perDrinkLines([{ ...line, prep: typed }]).map((x) => [x.name, x.amount, x.unit]), [['Tempus Fugit Crème de Banane', '22.5', 'ml'], ['Red miso', '2.1', 'g']]);
}

console.log('batchLines checks passed');
