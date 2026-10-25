// Checks for the setup bar (stepProgress, b29) and job dates (b09) in lib/onboarding.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { jobYears, monthLabel, stepProgress } from './onboarding';

// Counted along the path they're on: before they answer, the short way (name, hospitality, taste, units, bring).
assert.deepEqual(stepProgress('name'), { at: 1, of: 5, label: 'Step 1 of 5' });
assert.deepEqual(stepProgress('hospitality', false, ['name']), { at: 2, of: 5, label: 'Step 2 of 5' });
// Yes: the career steps count from here.
assert.deepEqual(stepProgress('find', false, ['name', 'hospitality']), { at: 3, of: 10, label: 'Step 3 of 10' });
assert.deepEqual(stepProgress('work', false, ['name', 'hospitality', 'find']), { at: 4, of: 10, label: 'Step 4 of 10' });
assert.deepEqual(stepProgress('drinks', false, ['name', 'hospitality', 'find', 'work', 'past', 'menus']), { at: 7, of: 10, label: 'Step 7 of 10' });
assert.deepEqual(stepProgress('units', false, ['name', 'hospitality', 'find', 'work', 'past', 'menus', 'drinks', 'taste']), { at: 9, of: 10, label: 'Step 9 of 10' });
// A claim skips the career steps.
assert.deepEqual(stepProgress('find', false, ['name', 'hospitality'], 'claim'), { at: 3, of: 6, label: 'Step 3 of 6' });
assert.deepEqual(stepProgress('taste', false, ['name', 'hospitality', 'find']), { at: 4, of: 6, label: 'Step 4 of 6' });
// Home cooks: taste and units are steps 3 and 4, never after "Step 4 of 4".
assert.deepEqual(stepProgress('taste', false, ['name', 'hospitality']), { at: 3, of: 5, label: 'Step 3 of 5' });
assert.deepEqual(stepProgress('units', false, ['name', 'hospitality', 'taste']), { at: 4, of: 5, label: 'Step 4 of 5' });
// The owner's path: name, why, find your bar, then its page or adding it.
assert.deepEqual(stepProgress('bar', false, ['name', 'hospitality'], 'new'), { at: 3, of: 4, label: 'Step 3 of 4' });
assert.deepEqual(stepProgress('addbar', false, ['name', 'hospitality', 'bar']), { at: 4, of: 4, label: 'Step 4 of 4' });
// Bring in: the bar alone; its title carries "Last step".
assert.deepEqual(stepProgress('bring', false, ['name', 'hospitality', 'taste', 'units']), { at: 5, of: 5, label: null });
// A declined invite isn't a step.
assert.deepEqual(stepProgress('name', false, ['invite']), { at: 1, of: 5, label: 'Step 1 of 5' });
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
