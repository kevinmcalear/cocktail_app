import assert from 'node:assert/strict';

import { isOnNow, listRowState, onNowFilters } from './listRows';

const now = Date.parse('2026-11-03T12:00:00Z');
const row = (on_from: string | null, off_at: string | null, waiting: string | null = null) => ({ on_from, off_at, waiting });

assert.equal(listRowState(row(null, null), now), 'on', 'with the list');
assert.equal(listRowState(row('2026-11-01T00:00:00Z', null), now), 'on');
assert.equal(listRowState(row('2026-11-04T00:00:00Z', null), now), 'coming', 'from the next service');
assert.equal(listRowState(row(null, '2026-11-04T00:00:00Z'), now), 'going');
assert.equal(listRowState(row(null, null, 'on'), now), 'waiting_on');
assert.equal(listRowState(row('2026-11-04T00:00:00Z', null, 'on'), now), 'waiting_on', 'a wait outranks a date');
assert.equal(listRowState(row(null, '2026-11-03T12:00:00Z', 'off'), now), 'waiting_off');

assert.equal(isOnNow(row(null, null), now), true);
assert.equal(isOnNow(row(null, '2026-11-04T00:00:00Z'), now), true, 'on until it goes');
assert.equal(isOnNow(row(null, '2026-11-03T12:00:00Z', 'off'), now), true, 'a waiting take-off stays on');
assert.equal(isOnNow(row('2026-11-04T00:00:00Z', null), now), false);
assert.equal(isOnNow(row(null, null, 'on'), now), false);

assert.deepEqual(onNowFilters('2026-11-03T12:00:00.000Z'), ['waiting.is.null,waiting.eq.off', 'on_from.is.null,on_from.lte.2026-11-03T12:00:00.000Z']);
