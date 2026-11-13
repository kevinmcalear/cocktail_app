// Checks for the first round's words (lib/staffRound.ts). Run: npm run test:unit
import assert from 'node:assert/strict';

import { readyDestination, roundNote } from './staffRound';
import { startingBarUnit } from './units';

// Nobody "set" the round: it's the same three at every bar (walk 12 Nov).
assert.equal(roundNote('Caretaker’s'), 'Every new bartender at Caretaker’s starts with these three.');
assert.equal(roundNote(null), 'Every new bartender starts with these three.');
assert.doesNotMatch(roundNote('Little Rye'), /set these/);

// Ready's button says where it goes: Drinks when the bar has Tonight off (walk 12 Nov: it said Tonight, landed on Drinks).
assert.deepEqual(readyDestination(true), { href: '/', label: 'Go to Tonight', where: 'The menu, specs and prep are on Tonight.' });
assert.equal(readyDestination(false).href, '/drinks');
assert.equal(readyDestination(false).label, 'Go to Drinks');

// A new bar's unit: its country's (walk 12 Nov: a New York bar started on ml, 2 oz read 60 ml).
assert.equal(startingBarUnit('US'), 'oz');
assert.equal(startingBarUnit('us'), 'oz');
assert.equal(startingBarUnit('GB'), 'ml');
assert.equal(startingBarUnit(null), 'ml');

console.log('staffRound ok');
