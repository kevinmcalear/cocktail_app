import assert from 'node:assert/strict';

import { markDone, onAMenu, readRound, roundKind, roundView, seeDone, seeOpened, skipAll, startRound, yourMenuStep } from './firstRound';

const NOW = '2026-10-15T09:00:00Z';
const fresh = startRound(NOW);

// --- who gets which round ---
assert.equal(roundKind(40), 'make', 'Admin');
assert.equal(roundKind(35), 'make', 'Drink Creator');
assert.equal(roundKind(30), 'staff', 'Bartender');
assert.equal(roundKind(20), 'staff', 'Employee');

// --- reading what's stored ---
assert.equal(readRound(null), null);
assert.equal(readRound({ onboarded: true }), null, 'people from before the round never get one');
assert.equal(readRound({ first_round: { v: 2, started_at: NOW } }), null, 'an unknown version is ignored');
assert.deepEqual(readRound({ first_round: { v: 1, started_at: NOW, done: ['menu', 'nope', 3], seen: ['menus', 'prep'] } }), {
  v: 1,
  started_at: NOW,
  done: ['menu'],
  skipped_at: null,
  done_seen: false,
  seen: ['menus'],
  drink_id: null,
});
assert.equal(roundView(null, 'make').active, false, 'no round: every tab, no card');

// --- a maker's round: Library alone, then Menus, then Discover ---
let v = roundView(fresh, 'make');
assert.equal(v.active, true);
assert.equal(v.current?.key, 'house_spec');
assert.deepEqual(v.hidden, ['menus', 'discover'], 'a new venue opens with the Library alone');
assert.equal(v.opened, null);
assert.equal(v.total, 3);

let r = markDone(fresh, 'house_spec');
v = roundView(r, 'make');
assert.equal(v.current?.key, 'menu');
assert.deepEqual(v.hidden, ['discover'], 'Menus opens when its step comes up');
assert.equal(v.opened, 'menus', 'and says so once');
r = seeOpened(r, 'menus');
assert.equal(roundView(r, 'make').opened, null, 'seen');
assert.equal(markDone(r, 'house_spec'), r, 'marking twice changes nothing');

r = markDone(r, 'menu');
v = roundView(r, 'make');
assert.deepEqual(v.hidden, [], 'Discover opens for the last step');
assert.equal(v.opened, 'discover');
assert.equal(v.doneCount, 2);

r = markDone(r, 'discover');
v = roundView(r, 'make');
assert.equal(v.active, false, 'done: nothing held back');
assert.equal(v.showDone, true, 'a quiet card says the round is over');
assert.equal(roundView(seeDone(r), 'make').showDone, false, 'once');

// --- staff: Menus opens when they open the menu ---
v = roundView(fresh, 'staff');
assert.equal(v.current?.key, 'open_menu');
assert.deepEqual(v.hidden, ['menus', 'discover'], 'the Library alone, like a maker');
v = roundView(markDone(fresh, 'open_menu'), 'staff');
assert.deepEqual(v.hidden, [], 'Discover opens next');
assert.equal(v.current?.key, 'discover');

// --- Show me everything ---
v = roundView(skipAll(fresh, NOW), 'make');
assert.equal(v.active, false);
assert.deepEqual(v.hidden, []);
assert.equal(v.showDone, false, 'skipping everything ends it without the done card');

// --- a step done out of order still counts ---
v = roundView(markDone(fresh, 'menu'), 'make');
assert.equal(v.current?.key, 'house_spec');
assert.deepEqual(v.hidden, ['discover'], 'Menus stays open once its step is done');

// --- the menu step looks for the house spec ---
const menus = [
  { kind: 'menu', itemIds: ['negroni'] },
  { kind: 'rnd', itemIds: ['trial'] },
];
const made = markDone(fresh, 'house_spec', 'of-1');
assert.equal(made.drink_id, 'of-1');
assert.equal(onAMenu(made, menus), false, 'an old menu with other drinks is not the step');
assert.equal(onAMenu(made, [...menus, { kind: 'menu', itemIds: ['of-1'] }]), true, 'the Old Fashioned on a menu');
assert.equal(onAMenu(made, [{ kind: 'rnd', itemIds: ['of-1'] }]), false, 'an R&D collection is not a menu');
assert.equal(onAMenu(markDone(fresh, 'house_spec'), menus), true, 'skipped the first step: any menu with a drink');

console.log('firstRound.check: ok');

// Find yourself step 7: the menu on now, counting the drinks credited to you.
const nightGarden = { name: 'Night Garden', kind: 'menu', itemIds: ['moth', 'sour', 'quiet'], status: 'on' };
assert.deepEqual(yourMenuStep([nightGarden], new Set(['moth', 'sour'])), { title: 'Open the Night Garden menu', detail: '2 of its drinks are yours' });
assert.equal(yourMenuStep([nightGarden], new Set(['moth']))?.detail, '1 of its drinks is yours');
assert.equal(yourMenuStep([nightGarden], new Set(['other'])), null, 'none of yours: the plain step');
assert.equal(yourMenuStep([{ ...nightGarden, status: 'previous' }], new Set(['moth'])), null, 'only the menu on now');
