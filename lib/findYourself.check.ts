import assert from 'node:assert/strict';

import { countWaiting, waitingLine, workedBars } from './findYourself';

const job = (bar: string, person: string, o: Partial<{ is_current: boolean; is_shown: boolean; is_hidden: boolean }> = {}) => ({ bar_profile_id: bar, person_profile_id: person, is_current: true, is_shown: false, is_hidden: false, ...o });

const w = countWaiting(
  ['bar', 'ash', 'jo'],
  [
    { id: 'd1', creator_profile_id: 'ash', origin_bar_profile_id: 'bar' },
    { id: 'd2', creator_profile_id: 'ash', origin_bar_profile_id: 'bar' },
    { id: 'd3', creator_profile_id: 'jo', origin_bar_profile_id: 'other' },
  ],
  // Ash also co-made d3; d1 twice counts once.
  [{ item_id: 'd3', profile_id: 'ash' }, { item_id: 'd1', profile_id: 'ash' }],
  // A past job counts when shown, never when hidden; one person once.
  [job('bar', 'ash'), job('bar', 'ash'), job('bar', 'jo', { is_current: false, is_shown: true }), job('bar', 'sam', { is_current: false }), job('bar', 'kim', { is_hidden: true })],
  new Set(['jo'])
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

console.log('findYourself checks passed');
