// Checks for the setup bar (stepProgress, b29) and job dates (b09) in lib/onboarding.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { jobYears, monthLabel, stepProgress } from './onboarding';

assert.deepEqual(stepProgress('name'), { at: 1, of: 4, label: 'Step 1 of 4' });
assert.deepEqual(stepProgress('hospitality'), { at: 1, of: 4, label: 'Step 1 of 4' });
assert.deepEqual(stepProgress('find'), { at: 2, of: 4, label: 'Step 2 of 4' });
assert.deepEqual(stepProgress('work'), { at: 2, of: 4, label: 'Step 2 of 4' });
assert.deepEqual(stepProgress('past'), { at: 3, of: 4, label: 'Step 3 of 4' });
assert.deepEqual(stepProgress('menus'), { at: 4, of: 4, label: 'Step 4 of 4' });
assert.deepEqual(stepProgress('drinks'), { at: 4, of: 4, label: 'Step 4 of 4' });
assert.deepEqual(stepProgress('taste'), { at: 4, of: 4, label: 'Almost done' });
assert.deepEqual(stepProgress('units'), { at: 4, of: 4, label: 'Almost done' });
// Bring in: the bar alone; its title carries "Last step".
assert.deepEqual(stepProgress('bring'), { at: 4, of: 4, label: null });
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
