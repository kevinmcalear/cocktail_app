import assert from 'node:assert/strict';

import { allergenSummary, allergyLine, menuLens, methodLine, rowStateMark } from './menuLens';

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

console.log('menuLens ok');
