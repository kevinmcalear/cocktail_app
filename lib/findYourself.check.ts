import assert from 'node:assert/strict';

import { countWaiting, madeByGroups, madeByStats, waitingLine, workedBars, type DrinkRun } from './findYourself';

const job = (bar: string, person: string, o: Partial<{ is_current: boolean; is_shown: boolean; is_hidden: boolean }> = {}) => ({ bar_profile_id: bar, person_profile_id: person, is_current: true, is_shown: false, is_hidden: false, ...o });

const w = countWaiting(
  ['bar', 'ash', 'jo'],
  [
    { id: 'd1', creator_profile_id: 'ash' },
    { id: 'd2', creator_profile_id: 'ash' },
    { id: 'd3', creator_profile_id: 'jo' },
  ],
  // Ash also co-made d3; d1 twice counts once.
  [{ item_id: 'd3', profile_id: 'ash' }, { item_id: 'd1', profile_id: 'ash' }],
  // A past job counts when shown, never when hidden; one person once.
  [job('bar', 'ash'), job('bar', 'ash'), job('bar', 'jo', { is_current: false, is_shown: true }), job('bar', 'sam', { is_current: false }), job('bar', 'kim', { is_hidden: true })],
  new Set(['jo']),
  // The server counts a bar's own drinks.
  { bar: 2 }
);
assert.deepEqual(w, { bar: { drinks: 2, people: 2, claimed: false }, ash: { drinks: 3, people: 0, claimed: false }, jo: { drinks: 1, people: 0, claimed: true } });

assert.equal(waitingLine('bar', { drinks: 12, people: 4 }), '12 drinks · 4 people');
assert.equal(waitingLine('bar', { drinks: 0, people: 1 }), '1 person');
assert.equal(waitingLine('bar', { drinks: 0, people: 0 }), null);
assert.equal(waitingLine('person', { drinks: 5, people: 0 }), '5 drinks credited');
assert.equal(waitingLine('person', { drinks: 1, people: 0 }), '1 drink credited');
assert.equal(waitingLine('person', undefined), null);

const bar = (display_name: string) => ({ display_name });
assert.equal(workedBars([{ is_current: false, bar: bar('Little Rye') }, { is_current: true, bar: bar('Pale Moth') }]), 'Pale Moth · Little Rye');
assert.equal(workedBars([{ is_current: true, bar: bar('A') }, { is_current: true, bar: bar('A') }, { is_current: false, bar: null }]), 'A');
assert.equal(workedBars([]), null);

// Made by Ash: the bar with a menu on now first, then the bar they left, then drinks with no bar.
const run = (itemId: string, barId: string, editionId: string, editionName: string, startYear: number, endYear: number | null, isCurrent = false): DrinkRun => ({ itemId, barId, editionId, editionName, startYear, endYear, isCurrent });
const runs = [run('martini', 'pm', 'ng', 'Night Garden', 2026, null, true), run('spritz', 'pm', 'ng', 'Night Garden', 2026, null, true), run('smoke', 'lr', 'fn', 'Field Notes', 2023, 2023), run('honey', 'lr', 'au', 'Autumn', 2022, 2022)];
const groups = madeByGroups(
  [
    { id: 'honey', name: 'Burnt Honey Sour', barId: 'lr', barName: 'Little Rye', others: ['Sam Ortiz'] },
    { id: 'smoke', name: 'Smoke Signal', barId: 'lr', barName: 'Little Rye', others: [] },
    { id: 'spritz', name: 'Moth Spritz', barId: 'pm', barName: 'Pale Moth', others: [] },
    { id: 'martini', name: 'Moth Light Martini', barId: 'pm', barName: 'Pale Moth', others: [] },
    { id: 'home', name: 'Kitchen Sour', barId: null, barName: null, others: [] },
  ],
  runs,
  { lr: '2022 to 2024' }
);
assert.deepEqual(
  groups.map((g) => g.label),
  ['Pale Moth · Night Garden, on now', 'Little Rye · 2022 to 2024', 'Other drinks']
);
assert.deepEqual(groups[0].rows.map((r) => [r.name, r.caption]), [['Moth Light Martini', 'On now'], ['Moth Spritz', 'On now']]);
assert.deepEqual(groups[1].rows.map((r) => r.caption), ['with Sam Ortiz · Autumn menu · 2022', 'Field Notes menu · 2023']);
assert.equal(groups[2].rows[0].caption, null);
assert.deepEqual(madeByStats(groups, runs), { drinks: 5, bars: 2, menus: 3 });
// Bars they worked at count too, once each: no drinks yet still isn't "0 bars".
assert.deepEqual(madeByStats(groups, runs, ['lr', 'bar7']), { drinks: 5, bars: 3, menus: 3 });
assert.deepEqual(madeByStats([], [], ['bar7', 'omakase']), { drinks: 0, bars: 2, menus: 0 });
// With no job, a bar's label is the years its menus ran.
assert.equal(madeByGroups([{ id: 'smoke', name: 'Smoke Signal', barId: 'lr', barName: 'Little Rye', others: [] }, { id: 'honey', name: 'Burnt Honey Sour', barId: 'lr', barName: 'Little Rye', others: [] }], runs)[0].label, 'Little Rye · 2022 to 2023');

console.log('findYourself checks passed');
