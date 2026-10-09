// Checks for lib/scale.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { toQuantity } from './quantity';
import {
  countdown, factorForLine, factorForYield, factorLabel, gramsPer100ml, leadTimeLabel, scaleRecipe, scaledYield, shelfLifeLabel, timerLabel, totals, totalsLine,
} from './scale';

// The brief's honey-ginger syrup: 500 g honey, 250 ml hot water, 150 ml ginger juice, yields 750 ml.
const syrup = [
  { id: 'h', name: 'Honey', amount: 500, unit: 'g' },
  { id: 'w', name: 'Hot water', amount: 250, unit: 'ml' },
  { id: 'g', name: 'Ginger juice', amount: 150, unit: 'ml' },
];
const t = totals(syrup);
assert.deepEqual(t, { ml: 400, g: 500, other: 0 });
assert.equal(totalsLine(t), '500 g + 400 ml');
assert.equal(gramsPer100ml(t, 750, 'ml'), null, 'mixed weights and volumes give no honest density');

// A weighed prep: 1000 g water and 1000 g sugar yield 1150 ml.
const gomme = [
  { id: 'w', name: 'Water', amount: 1000, unit: 'g' },
  { id: 's', name: 'Sugar', amount: 1000, unit: 'g' },
];
assert.equal(totalsLine(totals(gomme)), '2 kg');
assert.equal(gramsPer100ml(totals(gomme), 1150, 'ml'), 174, 'grams per 100 ml, as Ethyl shows it');
assert.equal(gramsPer100ml(totals(gomme), null, null), null);

// Scaling.
assert.deepEqual(scaleRecipe(syrup, 2).map((l) => l.scaled), ['1 kg', '500 ml', '300 ml']);
assert.equal(scaledYield(750, 'ml', 2), '1.5 L');
assert.equal(scaledYield(null, null, 2), null);
assert.equal(factorForYield(750, 'ml', toQuantity(2, 'l')), 2 / 0.75, 'to 2 L');
assert.equal(factorForYield(750, 'ml', toQuantity(500, 'g')), null, 'a weight target for a volume yield is refused');
assert.equal(factorForLine(syrup[2], toQuantity(320, 'ml')), 320 / 150, 'from what I have');
assert.equal(factorForLine(syrup[0], toQuantity(1, 'l')), null, 'litres of honey is not a weight');
const fromGinger = scaleRecipe(syrup, factorForLine(syrup[2], toQuantity(320, 'ml'))!);
assert.deepEqual(fromGinger.map((l) => l.scaled), ['1.1 kg', '533 ml', '320 ml']);
assert.equal(factorLabel(2), '×2');
assert.equal(factorLabel(320 / 150), '×2.13');
assert.equal(factorLabel(1.5), '×1.5');

// Labels.
assert.equal(shelfLifeLabel(null), null);
assert.equal(shelfLifeLabel(24), '1 day');
assert.equal(shelfLifeLabel(36), '36 hours');
assert.equal(shelfLifeLabel(24 * 7), '7 days');
assert.equal(shelfLifeLabel(24 * 21), '3 weeks');
assert.equal(leadTimeLabel(20, null), '20 min');
assert.equal(leadTimeLabel(120, null), '2 h');
assert.equal(leadTimeLabel(24 * 60, null), '24 h');
assert.equal(leadTimeLabel(3 * 24 * 60, null), '3 days');
assert.equal(leadTimeLabel(1440, '24 h drip'), '24 h drip');
assert.equal(leadTimeLabel(null, null), null);
assert.equal(timerLabel(45), '45 s');
assert.equal(timerLabel(180), '3 min');
assert.equal(timerLabel(5400), '1 h 30');
assert.equal(timerLabel(7200), '2 h');
assert.equal(countdown(155), '02:35');
assert.equal(countdown(-3), '00:00');

console.log('scale ok');
