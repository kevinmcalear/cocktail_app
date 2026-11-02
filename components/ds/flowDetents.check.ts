import assert from 'node:assert/strict';

import { flowDetents } from './flowDetents';

// Full height only: the sheet can't be pulled down to a smaller stop.
assert.deepEqual(flowDetents(undefined), { detents: ['large'], rest: 'large' });
assert.deepEqual(flowDetents(Number.NaN), { detents: ['large'], rest: 'large' });

// Part-way: rests there, can be pulled to full.
assert.deepEqual(flowDetents(0.6), { detents: [{ fraction: 0.6 }, 'large'], rest: { fraction: 0.6 } });

// Kept between a small sheet and a full one.
assert.deepEqual(flowDetents(0.1).rest, { fraction: 0.3 });
assert.deepEqual(flowDetents(1).rest, { fraction: 0.9 });

console.log('flowDetents ok');
