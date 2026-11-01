import assert from 'node:assert/strict';

import { markDone, markRead, onAMenu, readRound, roundKind, roundView, seeDone, seeOpened, skipAll, startRound } from './firstRound';
import { firstName, houseMadeLine, nextShift, readProgress, rotaLine, roundSetter, shiftDay } from './staffRound';

const NOW = '2026-10-15T09:00:00Z';
const fresh = startRound(NOW);

// --- the old staff round ---
assert.ok(readRound({ first_round: { v: 1, started_at: NOW, done: ['open_menu', 'discover'], seen: [] } })?.skipped_at, 'past the old round: not a new hire');
assert.equal(readRound({ first_round: { v: 1, started_at: NOW, done: [], seen: [] } })?.skipped_at, null, 'a round not begun carries on');

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

// --- staff: three things, nothing held back ---
v = roundView(fresh, 'staff');
assert.equal(v.current?.key, 'read_menu');
assert.deepEqual(v.hidden, [], 'Your first round holds nothing back');
assert.deepEqual(v.steps.map((x) => x.title), ['Read tonight’s menu', 'Learn the house-made', 'Log a batch']);
assert.equal(roundView(markDone(fresh, 'read_menu'), 'staff').current?.key, 'house_made');

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

// --- reading tonight's menu one drink at a time ---
const menu = ['martini', 'penicillin', 'clover'];
let read = markRead(fresh, 'martini', { menu });
assert.deepEqual(readProgress(read, menu), { read: 1, next: 'penicillin' });
assert.equal(markRead(read, 'martini', { menu }).read?.length, 1, 'twice counts once');
read = markRead(markRead(read, 'clover', { menu }), 'penicillin', { menu });
assert.ok(read.done.includes('read_menu'), 'every drink read: the step is done');
assert.deepEqual(readProgress(read, menu), { read: 3, next: null });
assert.deepEqual(readProgress(null, menu), { read: 0, next: 'martini' });
assert.deepEqual(readRound({ first_round: { v: 1, started_at: NOW, read: ['martini', 4] } })?.read, ['martini'], 'read ids are kept');
read = markRead(fresh, 'grenadine', { houseMade: ['grenadine'] });
assert.ok(read.done.includes('house_made') && !read.done.includes('read_menu'), 'the house-made step on its own');

// --- the round's lines ---
assert.equal(houseMadeLine(['Honey-ginger', 'Grenadine', 'Saline', 'Orgeat']), 'Honey-ginger, grenadine, saline');
assert.equal(houseMadeLine([]), null);
assert.equal(firstName('Ana Ruiz'), 'Ana');
const team = [
  { user_id: 'me', role_level: 40, display_name: 'Me Myself', joined_at: '2026-01-01' },
  { user_id: 'theo', role_level: 30, display_name: 'Theo', joined_at: '2025-01-01' },
  { user_id: 'ana', role_level: 40, display_name: 'Ana Ruiz', joined_at: '2025-06-01' },
  { user_id: 'bo', role_level: 40, display_name: 'Bo', joined_at: '2025-09-01' },
];
assert.equal(roundSetter(team, 'me', 40), 'Ana Ruiz', 'the Admin there longest, never you');
assert.equal(roundSetter(team.slice(0, 2), 'me', 40), null, 'no Admin: Your bar set these');

// --- Ready: the next shift on the rota ---
const T = Date.parse('2026-11-04T12:00:00Z');
const shifts = [
  { user_id: 'theo', starts_at: '2026-11-06T21:00:00Z', ends_at: '2026-11-07T05:00:00Z', opens: true, closes: false },
  { user_id: 'me', starts_at: '2026-11-06T23:00:00Z', ends_at: '2026-11-07T07:00:00Z', opens: false, closes: true },
  { user_id: 'bo', starts_at: '2026-11-08T21:00:00Z', ends_at: '2026-11-09T05:00:00Z', opens: true, closes: true },
];
const next = nextShift(shifts, 'me', T);
assert.equal(next?.mine.user_id, 'me');
assert.deepEqual(next?.others.map((s) => s.user_id), ['theo'], 'only who overlaps your shift');
assert.equal(rotaLine(next!, (id) => (id === 'theo' ? 'Theo' : id)), 'Theo opens, you close.');
assert.equal(rotaLine({ mine: { ...shifts[1], opens: true }, others: [] }, String), 'You open and close.');
assert.equal(rotaLine({ mine: { ...shifts[1], closes: false }, others: [] }, String), null, 'the rota says neither');
assert.equal(nextShift(shifts, 'me', Date.parse('2026-11-08T00:00:00Z')), null, 'past shifts are not next');
assert.equal(nextShift(shifts, null, T), null);
assert.equal(shiftDay('2026-11-06T12:00:00', new Date('2026-11-04T12:00:00')), 'Friday');
assert.equal(shiftDay('2026-11-04T20:00:00', new Date('2026-11-04T12:00:00')), 'tonight');

console.log('firstRound.check: ok');
