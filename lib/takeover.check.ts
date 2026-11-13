import assert from 'node:assert/strict';

import { ROLE_PRESETS } from './roleMatrix';
import { accessEnds, clock, defaultAccessEnd, houseTonight, nightWhen, refusalWords, stillOpen, takeoverRoleNames } from './takeover';

const at = (d: number, h: number, m = 0) => new Date(2025, 10, d, h, m).toISOString();

assert.equal(clock(new Date(2025, 10, 6, 20)), '8pm');
assert.equal(clock(new Date(2025, 10, 6, 0)), '12am');
assert.equal(clock(new Date(2025, 10, 6, 20, 30)), '8:30pm');
// The board's eyebrow and the guest's end.
assert.equal(nightWhen(at(6, 20), at(7, 2)), 'Thu 6 Nov, 8pm to 2am');
assert.equal(nightWhen(at(6, 20), null), 'Thu 6 Nov, 8pm');
assert.equal(nightWhen(null, null), null);
assert.equal(accessEnds(at(7, 4)), 'Fri 7 Nov, 4am');
assert.equal(defaultAccessEnd(at(6, 20), at(7, 2)), new Date(at(7, 4)).toISOString());
assert.equal(defaultAccessEnd(at(6, 20), null), new Date(at(7, 20)).toISOString());

// Still open: drinks with no count, asked of the first name.
assert.deepEqual(
  stillOpen([{ id: 'a', name: 'Green Hour', serves: 60 }, { id: 'b', name: 'Late Shift', serves: null }, { id: 'c', name: 'Velvet Owl', serves: 0 }], 'Mika'),
  [
    { key: 'b', name: 'Late Shift', why: 'No count yet', ask: 'Ask Mika' },
    { key: 'c', name: 'Velvet Owl', why: 'No count yet', ask: 'Ask Mika' },
  ],
);
assert.equal(stillOpen([{ id: 'b', name: 'Late Shift', serves: null }], null)[0].ask, null);

// The house list: off tonight per drink, or all off with the house menu.
const house = [{ id: 'jack' }, { id: 'toddy' }, { id: 'sour' }];
assert.equal(houseTonight(house, new Set(['toddy']), true).on, 2);
assert.equal(houseTonight(house, new Set(['toddy']), null).drinks[1].on, false);
assert.equal(houseTonight(house, new Set(), false).on, 0);
// A bar's second takeover gets its own guest role: never the preset's name (unique per bar), never over 40 letters, never the same night twice.
const preset = ROLE_PRESETS.find((p) => p.id === 'takeover')!.name.toLowerCase();
const thursday = takeoverRoleNames(at(6, 20), 'Night Owl');
const friday = takeoverRoleNames(at(7, 20), 'Pale Moth');
assert.equal(thursday[0], 'Takeover bartender, Thu 6 Nov');
assert.ok([...thursday, ...friday].every((n) => n.toLowerCase() !== preset && n.length <= 40));
assert.notEqual(thursday[0], friday[0]);
assert.equal(new Set(thursday.map((n) => n.toLowerCase())).size, thursday.length);
assert.ok(takeoverRoleNames(null, 'A very long guest bar name that goes on and on').every((n) => n.length <= 40));

// Refusals say what happened; a policy's raw words and the rest go to the fallback.
const fallback = () => 'fallback';
assert.equal(refusalWords({ code: '22023', message: 'They’re already on your team.' }, fallback), 'They’re already on your team.');
assert.equal(refusalWords({ code: '42501', message: 'You need the invite and manage staff permission to add members.' }, fallback), 'You need the invite and manage staff permission to add members.');
assert.equal(refusalWords({ code: '42501', message: 'new row violates row-level security policy for table "venue_roles"' }, fallback), 'fallback');
assert.equal(refusalWords(new TypeError('Failed to fetch'), fallback), 'fallback');
console.log('takeover: the page’s words');
