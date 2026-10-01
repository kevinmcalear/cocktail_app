// Checks for lib/prepCalcs.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { cordial, foam, formatPrepAmount, guessPrep, matchPrepLines, mergePrepRecipe, soda, superJuice, syrup } from './prepCalcs';

const line = (lines: { name: string; amount: number }[] | null, name: string) => {
  const found = lines?.find((l) => l.name === name);
  assert.ok(found, name);
  return found.amount;
};
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.02, `expected ${b}, got ${a}`);

const lemon = superJuice('lemon', 100);
near(line(lemon, 'Lemon peels'), 100);
near(line(lemon, 'Citric acid'), 100);
near(line(lemon, 'Water'), 1666);
assert.equal(lemon?.some((l) => l.name === 'Malic acid'), false);

const lime = superJuice('lime', 100);
near(line(lime, 'Citric acid'), 66.67);
near(line(lime, 'Malic acid'), 33.33);
near(line(lime, 'Water'), 1666);

const orange = superJuice('orange', 21.9);
near(line(orange, 'Citric acid'), 19.71);
near(line(orange, 'Malic acid'), 2.19);

const grape = superJuice('grapefruit', 100);
near(line(grape, 'Citric acid'), 80);
near(line(grape, 'Malic acid'), 20);
near(line(grape, 'MSG'), 3.3);

const kumquat = superJuice('kumquat', 100);
near(line(kumquat, 'Kumquats'), 100);
near(line(kumquat, 'Citric acid'), 25);
near(line(kumquat, 'Water'), 416.5);
assert.equal(superJuice('lemon', 0), null);

const simple = syrup('one', 300);
near(line(simple, 'Sugar'), 150);
near(line(simple, 'Water'), 150);
const rich = syrup('rich', 300);
near(line(rich, 'Sugar'), 200);
near(line(rich, 'Water'), 100);
const honey = syrup('honey', 164);
near(line(honey, 'Honey'), 100);
near(line(honey, 'Water'), 64);
assert.equal(syrup('agave', 0), null);

const batch = foam(500);
near(line(batch, 'Water'), 500);
near(line(batch, 'Methylcellulose'), 3);
near(line(batch, 'Xanthan gum'), 0.3);
near(line(batch, 'Gum arabic'), 20);
near(line(foam(250), 'Methylcellulose'), 1.5);
assert.equal(foam(-1), null);

const twoToOne = cordial('2:1', 300);
near(line(twoToOne, 'Syrup'), 200);
near(line(twoToOne, 'Citrus juice'), 100);
near(line(cordial('1:1', 200), 'Syrup'), 100);
assert.equal(cordial('3:2', 0), null);

const bottle = soda(200);
near(line(bottle, 'Syrup'), 30);
near(line(bottle, 'Carbonated water'), 170);
near(line(soda(400), 'Syrup'), 60);

assert.equal(formatPrepAmount(1666), '1666');
assert.equal(formatPrepAmount(66.666), '66.67');
assert.equal(formatPrepAmount(0.06), '0.06');

assert.equal(guessPrep('Lime super juice').citrus, 'lime');
assert.equal(guessPrep('Honey syrup').syrup, 'honey');
assert.equal(guessPrep('Rich demerara syrup').syrup, 'rich');
assert.equal(guessPrep('Super foam').kind, 'foam');
assert.equal(guessPrep('Grapefruit cordial').kind, 'cordial');
assert.equal(guessPrep('Kumquat soda').kind, 'soda');
assert.equal(guessPrep('Daiquiri').kind, 'juice');

const matched = matchPrepLines(superJuice('lemon', 100)!, [
  { id: 'citric', name: 'Citric Acid' },
  { id: 'water', name: 'water' },
]);
assert.equal(matched.find((l) => l.name === 'Citric Acid')!.ingredient_id, 'citric');
assert.equal(matched.find((l) => l.name === 'water')!.amount, '1666');
assert.equal(matched.find((l) => l.name === 'Lemon peels')!.ingredient_id, null);

const merged = mergePrepRecipe(
  [{ ingredient_id: 'water', name: 'water', amount: '10', unit: 'g' as const }],
  [
    { ingredient_id: 'water', name: 'Water', amount: '1666', unit: 'g' },
    { ingredient_id: 'citric', name: 'Citric Acid', amount: '100', unit: 'g' },
  ],
);
assert.deepEqual(merged.map((l) => [l.ingredient_id, l.amount]), [['water', '1666'], ['citric', '100']]);

console.log('prepCalcs: ok');
