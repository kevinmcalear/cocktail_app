import assert from 'node:assert/strict';

import { allergenChips, allergenSummary, allergensTonight, allergyLine, isLivingList, menuLens, methodLine, rowStateMark, tastedLine } from './menuLens';

const bar = 'b1';
assert.equal(menuLens({ barId: null, caps: null, roleLevel: null, mine: true }), 'home');
assert.equal(menuLens({ barId: null, caps: null, roleLevel: null, mine: false }), 'guest');
assert.equal(menuLens({ barId: bar, caps: [], roleLevel: 0, mine: false }), 'guest');
assert.equal(menuLens({ barId: bar, caps: ['menu', 'talking_points'], roleLevel: 10, mine: false }), 'employee');
assert.equal(menuLens({ barId: bar, caps: ['menu', 'talking_points', 'specs'], roleLevel: 20, mine: false }), 'bartender');
assert.equal(menuLens({ barId: bar, caps: ['specs', 'menus'], roleLevel: 30, mine: false }), 'creator');
assert.equal(menuLens({ barId: bar, caps: ['specs', 'menus'], roleLevel: 40, mine: false }), 'admin');

assert.equal(menuLens({ barId: bar, caps: ['specs', 'menus'], roleLevel: 40, mine: false, viewAs: 10 }), 'guest');
assert.equal(menuLens({ barId: bar, caps: ['specs', 'menus'], roleLevel: 40, mine: false, viewAs: 30 }), 'bartender');
assert.equal(menuLens({ barId: bar, caps: ['menus'], roleLevel: 35, mine: false, viewAs: 40 }), 'creator');

assert.equal(methodLine(['Stirred'], 'Nick & Nora', 'olive on a pick'), 'Stirred · Nick & Nora · olive on a pick');
assert.equal(methodLine(['Dry shake', 'Shaken'], null, ' '), 'Dry shake, Shaken');
assert.equal(methodLine([], null, null), '');

const day = (iso: string) => iso.slice(0, 10);
assert.equal(rowStateMark('on', null, null, day), null);
assert.equal(rowStateMark('coming', '2026-11-07T00:00:00Z', null, day), 'On from 2026-11-07');
assert.equal(rowStateMark('going', null, '2026-11-30T00:00:00Z', day), 'Off from 2026-11-30');
assert.equal(rowStateMark('waiting_on', null, null, day), 'Waiting to go on');

assert.equal(allergyLine(['Egg'], 1), 'Egg in 1 drink');
assert.equal(allergyLine(['Egg'], 0), null);
assert.equal(allergenSummary(new Map([['Egg', 1], ['Sulphites', 2]])), 'Egg in 1 · sulphites in 2');
assert.equal(allergenSummary(new Map()), 'None on this menu');

// Safety: an unchecked drink never reads as free of allergens.
assert.deepEqual(allergenChips(undefined, true), ['Not checked']);
assert.equal(allergenChips(undefined, false), null);
assert.deepEqual(allergenChips([], true), []);
assert.deepEqual(allergenChips(['Egg'], true), ['Egg']);
assert.equal(allergensTonight(new Map(), 0, 3), 'Not checked yet');
assert.equal(allergensTonight(new Map(), 3, 3), 'None on this menu');
assert.equal(allergensTonight(new Map(), 2, 3), '1 not checked');
assert.equal(allergensTonight(new Map([['Egg', 1]]), 2, 3), 'Egg in 1 · 1 not checked');

assert.equal(isLivingList([{ onFrom: null }], '2026-10-01T00:00:00Z'), false);
assert.equal(isLivingList([{ onFrom: '2026-10-01T00:00:00Z' }], '2026-10-01T00:00:00Z'), false);
assert.equal(isLivingList([{ onFrom: '2026-10-12T00:00:00Z' }], '2026-10-01T00:00:00Z'), true);
assert.equal(isLivingList([{ onFrom: null }], '2026-10-01T00:00:00Z', 1), true);

// Tasted and approved: who and the day, or the day alone once the approver has gone.
const oct28 = new Date(2026, 9, 28, 15).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
assert.equal(tastedLine('Ana Ruiz', new Date(2026, 9, 28, 15).toISOString()), `Tasted and approved by Ana Ruiz, ${oct28}.`);
assert.equal(tastedLine(null, new Date(2026, 9, 28, 15).toISOString()), `Tasted and approved, ${oct28}.`);

console.log('menuLens ok');
