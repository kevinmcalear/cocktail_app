import assert from 'node:assert/strict';

import { addedLine, becomesLine, dropKind, kindName, leftOutLine, NEW_SESSION, pick, shownHere, tick } from './myBarAdd';

const bar = new Set(['limes', 'gin']);
const has = (id: string) => bar.has(id);

// Only what you don't have, but a tick made since it opened stays in place.
assert.equal(shownHere('limes', has, NEW_SESSION), false);
assert.equal(shownHere('rye', has, NEW_SESSION), true);
let s = tick(NEW_SESSION, 'gin', 'Gin', true);
assert.equal(shownHere('gin', has, s), true, 'ticked just now: stays');
s = tick(s, 'gin', 'Gin', false);
assert.equal(shownHere('gin', () => false, s), true, 'unticked: still not on the bar, so still shown');
assert.deepEqual(tick(NEW_SESSION, 'x', 'X', false).ticked, [], 'an untick of something never ticked records nothing');

// The footer counts what's on the bar now, in the order ticked.
s = tick(tick(NEW_SESSION, 'gin', 'Gin', true), 'sv', 'Sweet vermouth', true);
assert.equal(addedLine(s, () => true), '2 added: Gin, Sweet vermouth');
assert.equal(addedLine(s, (id) => id === 'sv'), '1 added: Sweet vermouth');
assert.equal(addedLine(NEW_SESSION, () => true), null);

// Which gin?: a picked bottle takes Gin's place, and unticking the last pick puts Gin back.
const gin = { id: 'gin', name: 'Gin' };
s = tick(NEW_SESSION, 'gin', 'Gin', true);
const one = pick(s, 'gin', { id: 'tq', name: 'Tanqueray London Dry' }, true, true);
assert.deepEqual([one.add, one.remove], [['tq'], ['gin']]);
assert.equal(becomesLine(one.session, gin, (id) => id === 'tq'), 'Gin becomes Tanqueray London Dry');
assert.equal(shownHere('gin', () => false, one.session), true, 'the Gin tile stays, swapped');
const two = pick(one.session, 'gin', { id: 'hd', name: 'Hendrick’s' }, true, false);
assert.deepEqual([two.add, two.remove], [['hd'], []], 'Gin is already off');
assert.equal(becomesLine(two.session, gin, () => true), 'Gin becomes Tanqueray London Dry, Hendrick’s');
const off = pick(two.session, 'gin', { id: 'hd', name: 'Hendrick’s' }, false, false);
assert.deepEqual([off.add, off.remove], [[], ['hd']]);
const last = pick(off.session, 'gin', { id: 'tq', name: 'Tanqueray London Dry' }, false, false);
assert.deepEqual([last.add, last.remove], [['gin'], ['tq']], 'the last pick unticked: Gin goes back');
// Picked without Gin on the bar (All gins from a search): nothing to replace or put back.
const plain = pick(NEW_SESSION, 'gin', { id: 'tq', name: 'Tanqueray London Dry' }, true, false);
assert.deepEqual([plain.add, plain.remove], [['tq'], []]);
assert.equal(becomesLine(plain.session, gin, () => true), '1 added: Tanqueray London Dry');
assert.deepEqual(pick(plain.session, 'gin', { id: 'tq', name: 'T' }, false, false).add, []);

// The swapped Gin tile unticked: its bottles come off with it.
const dropped = dropKind(two.session, 'gin', 'Gin');
assert.deepEqual(dropped.remove, ['tq', 'hd']);
assert.deepEqual(dropped.session.picks.gin, []);
assert.deepEqual(dropped.session.replaced, []);
assert.equal(shownHere('gin', () => false, dropped.session), true, 'still in place');

assert.equal(leftOutLine(['Limes', 'Lime cordial']), 'Already on your bar: Limes, Lime cordial');
assert.equal(leftOutLine(['a', 'b', 'c', 'd', 'e', 'f']), 'Already on your bar: a, b, c, d and 2 more');
assert.equal(leftOutLine([]), null);

assert.equal(kindName('Gin'), 'gin');
assert.equal(kindName('Gin', true), 'gins');
assert.equal(kindName('Rye whiskey'), 'rye whiskey');
assert.equal(kindName('Irish whiskey', true), 'Irish whiskeys');
assert.equal(kindName('Amaro', true), 'amaros');
assert.equal(kindName('Brandy', true), 'brandies');
assert.equal(kindName('Bitters', true), 'bitters');

console.log('myBarAdd: ok');
