// Checks for the setup bar (stepProgress, b29) and job dates (b09) in lib/onboarding.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { jobYears, monthLabel, stepProgress } from './onboarding';

// Counted along the path they're on: before they answer, the short way (name, hospitality, taste).
assert.deepEqual(stepProgress('name'), { at: 1, of: 3, label: 'Step 1 of 3' });
assert.deepEqual(stepProgress('hospitality', false, ['name']), { at: 2, of: 3, label: 'Step 2 of 3' });
// Yes: the career steps count from here.
assert.deepEqual(stepProgress('find', false, ['name', 'hospitality']), { at: 3, of: 8, label: 'Step 3 of 8' });
assert.deepEqual(stepProgress('work', false, ['name', 'hospitality', 'find']), { at: 4, of: 8, label: 'Step 4 of 8' });
assert.deepEqual(stepProgress('drinks', false, ['name', 'hospitality', 'find', 'work', 'past', 'menus']), { at: 7, of: 8, label: 'Step 7 of 8' });
assert.deepEqual(stepProgress('taste', false, ['name', 'hospitality', 'find', 'work', 'past', 'menus', 'drinks']), { at: 8, of: 8, label: 'Step 8 of 8' });
// A claim skips the career steps.
assert.deepEqual(stepProgress('find', false, ['name', 'hospitality'], 'claim'), { at: 3, of: 4, label: 'Step 3 of 4' });
assert.deepEqual(stepProgress('taste', false, ['name', 'hospitality', 'find']), { at: 4, of: 4, label: 'Step 4 of 4' });
// Home cooks: taste is step 3, the last (units come later).
assert.deepEqual(stepProgress('taste', false, ['name', 'hospitality']), { at: 3, of: 3, label: 'Step 3 of 3' });
// The owner's Find your bar and Add your bar start the bar's setup: no count (venue setup counts from there).
assert.equal(stepProgress('bar', false, ['name', 'hospitality'], 'new'), null);
assert.equal(stepProgress('addbar', false, ['name', 'hospitality', 'bar']), null);
// "Is this you?" shares the name's number, and the steps after it don't shift.
// Back at the name for a taken handle: still step 1.
assert.deepEqual(stepProgress('name', false, ['name', 'hospitality', 'bar']), { at: 1, of: 3, label: 'Step 1 of 3' });
assert.deepEqual(stepProgress('you', false, ['name']), { at: 1, of: 3, label: 'Step 1 of 3' });
assert.deepEqual(stepProgress('hospitality', false, ['name', 'you']), { at: 2, of: 3, label: 'Step 2 of 3' });
assert.deepEqual(stepProgress('taste', false, ['name', 'you', 'hospitality']), { at: 3, of: 3, label: 'Step 3 of 3' });
// A declined invite isn't a step.
assert.deepEqual(stepProgress('name', false, ['invite']), { at: 1, of: 3, label: 'Step 1 of 3' });
assert.equal(stepProgress('invite'), null);

// The invited path counts its own three; the third is the app itself.
assert.deepEqual(stepProgress('name', true), { at: 1, of: 3, label: 'Step 1 of 3' });
assert.deepEqual(stepProgress('units', true), { at: 2, of: 3, label: 'Step 2 of 3' });
assert.equal(stepProgress('invite', true), null);

// A job's month and years (b09).
assert.equal(monthLabel({ year: 2023, month: 2 }), 'Feb 2023');
assert.equal(monthLabel(null), null);
assert.equal(jobYears({ start_year: 2023, is_current: true }), '2023 to now');
assert.equal(jobYears({ start_year: 2021, end_year: 2023, is_current: false }), '2021 to 2023');
assert.equal(jobYears({ start_year: 2021, end_year: 2021, is_current: false }), '2021');
assert.equal(jobYears({ start_year: 2019, is_current: false }), 'Since 2019');
assert.equal(jobYears({ is_current: true }), null);
