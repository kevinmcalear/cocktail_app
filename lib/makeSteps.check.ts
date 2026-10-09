// Checks for lib/makeSteps.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { initials, labelDate, stepParts, timerFromText, useByDate } from './makeSteps';

// Amounts go where the step names a line, once, at its first mention.
const rich = stepParts('Combine the sugar and water in a pan over low heat.', [
  { name: 'Sugar', amount: '664 g' },
  { name: 'Water', amount: '332 ml' },
]);
assert.deepEqual(rich, [
  { text: 'Combine the ' },
  { text: 'sugar', amount: '664 g' },
  { text: ' and ' },
  { text: 'water', amount: '332 ml' },
  { text: ' in a pan over low heat.' },
]);
assert.equal(rich.map((p) => p.text).join(''), 'Combine the sugar and water in a pan over low heat.', 'the words are kept as written');

// The last word of a longer name matches, plurals too; short words don't.
assert.deepEqual(
  stepParts('Slice the chilies, toss with the sugar.', [{ name: 'Fresno chili', amount: '2' }, { name: 'White sugar', amount: '300 g' }]).filter((p) => p.amount).map((p) => p.text),
  ['chilies', 'sugar'],
);
assert.deepEqual(stepParts('Add the gin.', [{ name: 'Dry gin', amount: '50 ml' }]), [{ text: 'Add the gin.' }], 'three-letter words are too loose to mark');
assert.deepEqual(stepParts('Stir until clear.', [{ name: 'Sugar', amount: '664 g' }]), [{ text: 'Stir until clear.' }]);
assert.deepEqual(stepParts('Add the sugar.', [{ name: 'Sugar', amount: '' }]), [{ text: 'Add the sugar.' }], 'a line with no amount is not marked');
// Overlapping names: the whole name wins over a shorter one inside it.
assert.deepEqual(
  stepParts('Add the apple cider vinegar.', [{ name: 'Apple cider vinegar', amount: '300 g' }, { name: 'Vinegar', amount: '5 ml' }]).filter((p) => p.amount),
  [{ text: 'apple cider vinegar', amount: '300 g' }],
);

// Timers from the words.
assert.equal(timerFromText('Steep 10 minutes, then strain.'), 600);
assert.equal(timerFromText('Rest for 2 hours'), 7200);
assert.equal(timerFromText('Take it off before it simmers. About 5 min.'), 300);
assert.equal(timerFromText('Cool, bottle, label.'), null);
assert.equal(timerFromText('Use 2 limes'), null, 'a number without a time unit is not a timer');
assert.equal(timerFromText('Leave 3 days in the fridge'), null, 'over a day is a reminder, not a countdown');
assert.equal(timerFromText('Infuse 5-10 minutes'), 300, 'a range starts at its low end');
assert.equal(timerFromText('1 day'), 86400, 'a timer typed as words');
assert.equal(timerFromText('4 h'), 14400);
assert.equal(timerFromText('24 h'), 86400);

// Dates and initials for the label.
const made = new Date(2026, 9, 9, 12);
assert.equal(labelDate(made), 'Fri 9 Oct');
assert.equal(labelDate(useByDate(made, 1344)!), 'Fri 4 Dec', '8 weeks');
assert.equal(useByDate(made, null), null);
assert.equal(initials('Kevin McAlear'), 'KM');
assert.equal(initials('  eddie '), 'E');
assert.equal(initials(null), '');

console.log('makeSteps checks passed');
