import assert from 'node:assert/strict';

import { EMPTY_DRAFT } from './drinkWizard';
import { addMaker, askLines, asked, makers, removeMaker } from './whoMadeIt';

const ME = { id: 'p-jo', name: 'Jo Park' };
const SAM = { id: 'p-sam', name: 'Sam Ortiz', sub: '@sam.ortiz · Little Rye', claimed: true };
const CW = { id: 'p-cw', name: 'Christine Williams', sub: '@christine.williams', claimed: false };
let d = { creator: EMPTY_DRAFT.creator, coCreators: EMPTY_DRAFT.coCreators };
const apply = (change: object) => (d = { ...d, ...change });

// You're on it to start; adding Sam saves him as made with, and he's asked first.
assert.deepEqual(makers(d, ME).map((m) => m.name), ['Jo Park']);
apply(addMaker(d, ME, SAM));
assert.deepEqual(makers(d, ME).map((m) => m.id), ['p-jo', 'p-sam']);
assert.deepEqual(d.coCreators, [SAM]);
assert.deepEqual(askLines(asked(d, ME)), ['We’ll ask Sam first. Sam’s name shows on the drink once Sam says yes.']);
// Twice is once.
assert.deepEqual(addMaker(d, ME, SAM), {});

// An unclaimed page says it waits there.
apply(addMaker(d, ME, CW));
assert.deepEqual(askLines(asked(d, ME)), ['We’ll ask Sam first. Sam’s name shows on the drink once Sam says yes.', 'Christine’s page isn’t claimed yet. The credit waits there until Christine claims it and says yes.']);

// Take yourself off: Sam becomes the maker, Christine stays made with.
apply(removeMaker(d, ME, makers(d, ME)[0]));
assert.deepEqual(d.creator, SAM);
assert.deepEqual(d.coCreators, [CW]);
assert.deepEqual(asked(d, ME).map((m) => m.id), ['p-cw']);

// Add yourself back: you're the maker again and Sam goes back to made with.
apply(addMaker(d, ME, ME));
assert.equal(d.creator, 'me');
assert.deepEqual(d.coCreators.map((c) => c.id), ['p-sam', 'p-cw']);

// Everyone off saves as Not sure.
for (const m of makers(d, ME)) apply(removeMaker(d, ME, m));
assert.equal(d.creator, 'nobody');
assert.deepEqual(makers(d, ME), []);
// The first one added to an empty list is the maker.
apply(addMaker(d, ME, SAM));
assert.deepEqual(d.creator, SAM);
assert.deepEqual(asked(d, ME), []);

// Two asked: one line naming both.
assert.deepEqual(askLines([{ ...SAM, me: false }, { id: 'p-a', name: 'Ash Lee', me: false }]), ['We’ll ask Sam and Ash first. Each name shows on the drink once they say yes.']);
// No profile of your own: nobody is you.
assert.deepEqual(makers({ creator: null, coCreators: [] }, null), []);
