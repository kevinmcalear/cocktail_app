import assert from 'node:assert/strict';

import { ICE_YIELD_UNITS, prepCardInput, prepFields, samePrepCard } from './prepCardForm';

const card = {
  prep: { yield_amount: 750, yield_unit: 'ml', shelf_life_hours: 24 * 7 * 4, lead_time_minutes: 20, lead_time_note: null, storage: 'Fridge', actions: ['Syrup'] },
  steps: [
    { body: 'Heat the honey', timer_seconds: 480, equipment: ['thermometer'] },
    { body: 'Whisk in the water', timer_seconds: null, equipment: [] },
  ],
};

// Four weeks reads as weeks, not 28 days or 672 hours.
const f = prepFields(card);
assert.equal(f.keeps, '4');
assert.equal(f.keepsUnit, 'weeks');
assert.equal(f.steps[0].timer, '8');

// What it loaded writes back the same.
const { input, problem } = prepCardInput(f);
assert.equal(problem, null);
assert.deepEqual(input.prep, card.prep);
assert.deepEqual(input.steps, card.steps);

// A fresh load (new step keys) isn't a change; an edit is.
assert.ok(samePrepCard(f, prepFields(card)));
assert.ok(!samePrepCard(f, { ...f, storage: 'Freezer' }));
// A blank step or trailing spaces don't count.
assert.ok(samePrepCard(f, { ...f, storage: 'Fridge ', steps: [...f.steps, { key: 'x', body: ' ', timer: '', tools: [] }] }));

// 36 hours keeps in hours; an empty card starts in days and ml.
assert.equal(prepFields({ prep: { ...card.prep, shelf_life_hours: 36 }, steps: [] }).keepsUnit, 'hours');
const empty = prepFields(null);
assert.equal(empty.keepsUnit, 'days');
assert.equal(empty.yieldUnit, 'ml');
assert.deepEqual(prepCardInput(empty).input.prep, { yield_amount: null, yield_unit: null, shelf_life_hours: null, lead_time_minutes: null, lead_time_note: null, storage: null, actions: [] });

// A step's tools load and save with it, and changing them is a change.
assert.deepEqual(f.steps[0].tools, ['thermometer']);
assert.ok(!samePrepCard(f, { ...f, steps: f.steps.map((s, i) => (i ? s : { ...s, tools: ['thermometer', 'Our ice stamp'] })) }));

// Ice makes pieces or kilos: a saved count stays a count, and a new card starts in pieces.
assert.equal(prepFields({ prep: { ...card.prep, yield_amount: 40, yield_unit: 'pieces' }, steps: [] }, ICE_YIELD_UNITS).yieldUnit, 'pieces');
assert.equal(prepFields(null, ICE_YIELD_UNITS).yieldUnit, 'pieces');

// Bad numbers stop the save with a reason.
assert.match(prepCardInput({ ...f, yieldAmount: '0' }).problem ?? '', /more than 0/);
assert.match(prepCardInput({ ...f, takes: '2.5' }).problem ?? '', /whole minutes/);
